/* global fetch */
import React from 'react';
import PropTypes from 'prop-types';
import cx from 'classnames';
import { stringify, parse } from 'query-string';
import Dashboard from './../dashboard';
import Widget from './widget';
import Perfherder from './perfherder';
import Benchmark from './benchmark';
import Countdown from './countdown';
import Flow from './flow';
import TelemetryContainer from '../telemetry/graph';
import AWFY from '../components/awfy/speedometer';
import SETTINGS from '../settings';

// Before this date we had a Speedometer benchmark update
// and that caused a baseline bump for all browsers
// Skipping this data makes the graphs easier to understand
const skipDataBefore = '2017-09-20';

const apzBugs = {
  1376525: {
    title: 'Keyboard Scrolling',
    update: 'Landed in 56 behind a preference. Enabled by default in 57.',
  },
  1211610: {
    title: 'Scrollbar Dragging',
    update: 'Landed in 55 and enabled by default.',
  },
  1367765: {
    title: 'Touch Scrollbar Dragging',
    update: 'Landed in 57 and enabled by default.',
  },
  1385463: {
    title: 'Autoscrolling',
    update: 'Landed in 56 behind a preference. Enabled by default in 57.',
  },
};

const statusLabels = new Map([
  ['red', 'at risk and not within target'],
  ['yellow', 'on track but not within target'],
  ['green', 'within target'],
  ['blue', 'signed off'],
  ['secondary', 'regression criteria at risk'],
]);

export default class QuantumIndex extends React.Component {
  constructor(props) {
    super(props);
    document.body.classList.add('multipage');
    this.fetchNotes();
  }

  state = {
    apzStatus: [],
    notes: {},
  };

  async fetchNotes() {
    try {
      const notes = await (await fetch(`${SETTINGS.backend}/api/perf/notes`)).json();
      this.setState({ notes });
    } catch (e) {
      console.warn('Failed to fetch notes.');
    }
    this.fetchApzStatus();
  }

  async fetchApzStatus() {
    const bugQuery = stringify({ ids: Object.keys(apzBugs) });
    const apzStatus = await (await fetch(`${SETTINGS.backend}/api/bz/status?${bugQuery}`)).json();
    this.setState({ apzStatus });
  }

  render() {
    const { apzStatus, notes } = this.state;
    const { full } = parse(this.props.location.search);

    const $apz = (
      <Widget
        key='ApzScrolling'
        title='APZ Scrolling'
        content={Object.keys(apzBugs).map((id) => {
          const bug = apzStatus.find(needle => String(needle.id) === String(id));
          let label = 'Loading …';
          if (bug) {
            label = bug.version
              ? `Landed in ${bug.version}`
              : bug.contact ? `Waiting for ${bug.contact}` : 'Unassigned';
          }
          return (
            <div className={'widget-entry'} key={`apz-${id}`}>
              <h4>
                {apzBugs[id].title}
                <small>
                  <a href={`https://bugzilla.mozilla.org/show_bug.cgi?id=${id}`} target='_new'>
                    Bug {id}
                  </a>
                </small>
              </h4>
              <span>
                {apzBugs[id].update || label}
              </span>
            </div>
          );
        })}
        {...notes.apz}
      />
    );

    const allStatus = new Map([['green', 0], ['yellow', 0], ['red', 0]]);
    for (const note of Object.values(notes)) {
      if (note.status) {
        allStatus.set(note.status, allStatus.get(note.status) + 1);
      }
    }

    const statusWidget = (
      <Widget
        key='RiskTargetStatusSummary'
        title='Risk/Target Status Summary'
        target='Be *on track* to be *within target*'
        className='widget-status-all'
        loading={Object.keys(notes).length === 0}
        content={
          Object.keys(notes).length
            ? [
              <div className='widget-entry' key='confidence'>
                {Array.from(allStatus.entries()).map(([color, count]) => {
                  if (!count) {
                    return null;
                  }
                  return (
                    <div className={`widget-entry-row status-${color}`} key={`status-${color}`}>
                      <span>
                        <em>{count}</em> criteria {statusLabels.get(color)}
                      </span>
                    </div>
                  );
                })}
              </div>,
            ]
            : 'Loading status …'
        }
      />
    );

    const sections = [
      // {
      //   rows: [[<Flow key='flow' />, <Countdown key='countdown' />, statusWidget]],
      // },
      {
        cssRowExtraClasses: 'generic-metrics-graphics speedometer-metrics-graphics',
        title: '#1 Speedometer v2',
        rows: [
          [
            <Perfherder
              title='Talos: Speedometer mozilla-central'
              key='talos-speedometer'
              reference='2017-10-12'
              signatures={{
                'win10-64': '797a2bfbbac2c632f4f354aff7677a3df3c749a3',
                'win7-32': '78730407dee56521f26d3621fa8156914b83025a',
                'win10-64-new': 'be6032b74e5c65e733f105927222b0880c2e9822',
                'win7-32-new': '5457539d78e242701e37dc114d79ff47b0fe4baa',
              }}
              {...notes.talos_speedometer}
            />,
          ],
          [
            <div className='speedometer-hardware-block'>
              <h2>Reference hardware - 64bit</h2>
              <div className='speedometer-grid'>
                <AWFY
                  title='Nightly, Beta & Canary'
                  key='speedometer-score'
                  id='speedometer-score'
                  benchmark='speedometer'
                  architecture={64}
                  browsers={['Nightly', 'Canary', 'Beta']}
                  targetBrowser={'Nightly'}
                  targetRatio={0.8}
                  skipDataBefore={skipDataBefore}
                />
                <AWFY
                  title='Nightly vs Canary December 2017'
                  key='speedometer-dec-2017'
                  id='speedometer-dec-2017'
                  benchmark='speedometer'
                  architecture={64}
                  browsers={['Nightly']}
                  targetBrowser={'Nightly'}
                  // AWFY after certain number of weeks it only shows a data point
                  // per week. This score is what AWFY showed on Dec. 27th, 2017 for this revision
                  // https://chromium.googlesource.com/v8/v8/+log/45ffb540b45a391f5e9848615d5654297a14eb14..bb5733a4d8b54bd49cf7053811d7ea1f41243d2f
                  // Grabed from:
                  // https://arewefastyet.com/#machine=36&view=single&suite=speedometer-misc&subtest=score
                  baseValue={50}
                  targetRatio={0.95}
                  skipDataBefore={skipDataBefore}
                />
              </div>
            </div>,
          ],
          [
            <div className='speedometer-hardware-block'>
              <h2>Reference hardware - 32bit</h2>
              <div className='speedometer-grid'>
                <AWFY
                  title='Nightly, Beta & Canary'
                  key='speedometer32-score'
                  id='speedometer32-score'
                  benchmark='speedometer'
                  architecture={32}
                  browsers={['Nightly', 'Canary', 'Beta']}
                  targetBrowser={'Nightly'}
                  targetRatio={0.8}
                  skipDataBefore={skipDataBefore}
                />
                <AWFY
                  title='Nightly vs Canary December 2017'
                  key='speedometer32-dec-2017'
                  id='speedometer32-dec-2017'
                  benchmark='speedometer'
                  architecture={32}
                  browsers={['Nightly']}
                  targetBrowser={'Nightly'}
                  // AWFY after certain number of weeks it only shows a data point
                  // per week. This score is what AWFY showed on Dec. 30th, 2017 for this revision
                  // https://chromium.googlesource.com/v8/v8/+log/3cbf26e8a21aa76703d2c3c51adb9c96119500da..0c287882ea233f299a91f6b72b56d8faaecf52c0
                  // Grabed from:
                  // https://arewefastyet.com/#machine=37&view=single&suite=speedometer-misc&subtest=score
                  baseValue={51}
                  targetRatio={0.95}
                  skipDataBefore={skipDataBefore}
                />
              </div>
            </div>,
          ],
        ],
      },
      {
        cssRowExtraClasses: 'generic-metrics-graphics photon-perf',
        title: '#2 Photon Performance',
        rows: [
          [
            <TelemetryContainer
              key={'winOpen'}
              id={'winOpen'}
              title='Window open'
            />,
            <TelemetryContainer
              key={'tabSwitch'}
              id={'tabSwitch'}
              title='Tab switch'
            />,
          ],
          [
            <TelemetryContainer
              key={'tabClose'}
              id={'tabClose'}
              title='Tab close'
            />,
            <TelemetryContainer
              key={'firstPaint'}
              id={'firstPaint'}
              title='First paint'
            />,
          ],
        ],
      },
      {
        title: '#3 Regression',
        rows: [
          [
            <Perfherder
              key='tp6_loaded'
              title='Talos TP6: Loaded'
              reference='2017-07-29'
              target='Not set'
              signatures={{
                'win10-64':
                  'd554681a57d858f77a7a3d8b58f5af9e82adae5c,9ef4e3fa8d78e5f459f804f2ddf0ee5e10e1c6a5,38fae8e31635a7dd92c7bde1b297f25cd5f6cdd0,a920958825b36891e19495c0669eccc21c751c03',
                'win7-32':
                  'b218982f76037c94aa0bc2e6f3102a3745fb0ef8,40762f6820e6cfd4531505caebccf27d46b0f037,a4884e6435dff7ffe3dda82b383552c7fa267e55,af835391eb98960df2aaa74c2d76200064e73c65',
                'win10-64-new':
                  'd3a968d51b5910ee0036b6e12b4dfe94b85fbf02,d2034c5b7b5b09f5056be096fb0c0cc302dbaa8a,15a824692389cd975bb75c1a20f018d89d3a1e2c,14be17a94af5bdeceb0d2e737583f8834cbdff01',
                'win7-32-new':
                  '9db2ed0e8ae67914cbfc72a3c8771e287eab6c8b,ae1e0fe16eef66bea2a5042ecb82be23423ff40c,054706052ce54d631bf45439012af2b2ce9baefc,842c3562d0e72fec5cdb9b6bb417f27e449369fb',
              }}
              {...notes.talos_tp6_loaded}
            />,
            <Perfherder
              key='pageload_tp5'
              title='Page Load (tp5)'
              reference='2017-04-20'
              signatures={{
                'win10-64': 'c00763b23b39207671b795a12ba29d38ddc17f06',
                'win7-32': 'ac46ba40f08bbbf209a6c34b8c054393bf222e67',
                'win10-64-new': '47e116b3dd2d879046075f5e335b645375770dac',
                'win7-32-new': '849809c194f30c8e676e8ba6f8cb4ac55b82ab1b',
              }}
              {...notes.talos_tp5}
            />,
            <Perfherder
              key='tpaint'
              title='Window Opening (tpaint e10s)'
              reference='2017-07-06'
              signatures={{
                'win10-64': '9525bb9b68bda10ed26b7c1999ba40830827c792',
                'win7-32': '729285324ec4b164b8d3ecec42c2fdb344f7e581',
                'win10-64-new': '1d2a194fc59a1e8a7635d05f9ecac80a73770bb5',
                'win7-32-new': 'a97a6a22157860fba4f5668be057d65b1aed6166',
              }}
              {...notes.talos_tpaint}
            />,
          ],
          [
            <Perfherder
              key='startup_session_restore'
              title='Start-up (sessionrestore)'
              reference='2017-04-13'
              signatures={{
                'win10-64': '577f4c3e31bc186dbfebdef9e40571569764d613',
                'win7-32': '196b82960327035de720500e1a5f9f0154cf97ad',
                'win10-64-new': 'ada730f8a61c3e00f17c42d9ddf694922e77ab90',
                'win7-32-new': 'da50dcf77aeed243002772e4ff03028209aabc17',
              }}
              {...notes.talos_sessionrestore}
            />,
            <Perfherder
              key='startup_session_restore_no_auto_restore'
              title='Start-up (sessionrestore_no_auto_restore)'
              reference='2017-05-11'
              signatures={{
                'win10-64': 'aea56740bf668dd859d84f71e384023cc11e53e1',
                'win7-32': 'ba16f34b35fb3492dc22f3774aff2d010e5f10ba',
                'win10-64-new': '7c207334aaddef8b6c6d46b25fe48179bae49b31',
                'win7-32-new': '0a88cb395efeb9e107e9175ccf8540156716d53b',
              }}
              {...notes.talos_sessionrestore_no_auto_restore}
            />,
            <Perfherder
              key='startup_ts_paint'
              title='Start-Up (ts_paint)'
              reference='2017-05-07'
              signatures={{
                'win10-64': '78fd32fcd82cb8bfa53b8c4a19f3f51b4e03ee1d',
                'win7-32': 'e394aab72917d169024558cbab33eb4e7e9504e1',
                'win10-64-new': '46dc6bb121842c6cd39243b81a22cd0ff869c4eb',
                'win7-32-new': '4dd563a14dd7e35efe136651cfd8fe8ab24f7f37',
              }}
              {...notes.talos_ts_paint}
            />,
          ],
          [
            <Perfherder
              {...notes.talos_tabpaint}
              key='tabpaint'
              title='Tab Opening (tabpaint)'
              reference='2017-06-15'
              signatures={{
                'win10-64': 'a9cd333dff68ce0812dc85e0657af4edfc51ebe3',
                'win7-32': '0bec96d78bc54370bd027af09bdd0edc8df7afd7',
                'win10-64-new': 'a59bffa7d0919fe8fc8b4b4aca26f3b8b81de87d',
                'win7-32-new': '39384d8456427b60deeb4485dcf2f0ba480fea56',
              }}
            />,
            <Perfherder
              title='Tab Animation (TART)'
              key='tart'
              reference='2017-05-07'
              signatures={{
                'win10-64': '7207561755a8cb6b27c68eafeef64d019c29045e',
                'win7-32': '710f43a8c2041fe3e67124305649c12a9d708858',
                'win10-64-new': '0eadaaff11bf7f50881f20b7980d21143c08d555',
                'win7-32-new': '41098223c1c7585b9af92ff51b83ea579d41e6d0',
              }}
              {...notes.talos_tart}
            />,
            <Perfherder
              key='tps'
              title='Tab Switch (tps)'
              reference='2017-05-07'
              signatures={{
                'win10-64': '7bdaad0fa21778103f4cd0d6bbe81fe3dc49040c',
                'win7-32': 'a86a2a069ed634663dbdef7193f2dee69b50dbc9',
                'win10-64-new': 'af6ed7d2f1403570f601af30927a2c95bf83a18b',
                'win7-32-new': '36fd1982e422701cc428a807b4d8826fc90d2ec1',
              }}
              {...notes.talos_tps}
            />,
          ],
          [
            <Perfherder
              {...notes.talos_tsvg_static}
              key='tsvg_static'
              title='SVG (tsvg_static)'
              reference='2017-04-08'
              signatures={{
                'win10-64': 'e4e0081ff90530932c463fc917d113936690baa3',
                'win7-32': '18cf40355e5b20164ab9307f83dd6d6eb6184aa8',
                'win10-64-new': '407876d55248b06a79bd35ad225d78391ea1241e',
                'win7-32-new': '9a0e5a9474c2dab77f47a7186c87f22d14492820',
              }}
            />,
            <Perfherder
              key='tsvgr_opacity'
              title='SVG (tsvgr_opacity)'
              reference='2016-10-26'
              signatures={{
                'win10-64': '18983f13f41e96fd1802d7e2cfc4bc07d200ec04',
                'win7-32': 'f22a87e9898beb0c7dc5fefec8267c3a9ad89a8b',
                'win10-64-new': 'dadfe12765e78b2d83e0fdd7a2a228e1d3d90224',
                'win7-32-new': '56fdd7810758d702786ed9ee002f3aa396ff327c',
              }}
              {...notes.talos_tsvgr_opacity}
            />,
            <Perfherder
              key='tsvgx'
              title='SVG (tsvgx)'
              reference='2017-05-07'
              signatures={{
                'win10-64': '190ff873a76e95b50748042f1d6cb21c7ce77575',
                'win7-32': 'c547c2f07fba319e59da1f6ffaf604a47ccfeaf0',
                'win10-64-new': 'a5811b7de0ffdfe834238f831a4d0c8d1f3413e9',
                'win7-32-new': '8ea36ed17eee7c7dda797d9369d5f49f66436bf5',
              }}
              {...notes.talos_tsvgx}
            />,
          ],
        ],
      },
    ];

    let rowIdx = 0;
    const $content = sections.reduce((reduced, { title, rows, cssRowExtraClasses }, sectionId) => {
      const add = [];
      const statusList = new Map(Array.from(statusLabels.keys()).map(key => [key, 0]));
      for (const widgets of rows) {
        for (const widget of widgets) {
          const secondary = widget.type.displayName === 'PerfherderWidget';
          if (!secondary) {
            statusList.set(widget.props.status, statusList.get(widget.props.status) + 1);
          } else if (widget.props.status === 'red') {
            statusList.set('secondary', statusList.get('secondary') + 1);
          }
        }
        let className = 'row';
        // Add 2nd class if indicated
        className += (cssRowExtraClasses) ? ` ${cssRowExtraClasses}` : '';
        rowIdx += 1;
        if (!full || sectionId < 2) {
          add.push(
            <div className={className} key={`row-${rowIdx}`}>
              {widgets}
            </div>,
          );
        }
      }
      const $status = [];
      for (const [status, count] of statusList) {
        if (statusLabels.has(status) && count) {
          $status.push(
            <div key={`status-${status}`} className={`header-status header-status-${status}`}>
              <em>{count}</em> {statusLabels.get(status)}
            </div>,
          );
        }
      }
      if ((!full || sectionId < 2) && title) {
        add.unshift(
          <h2 key={sectionId}>
            <span>
              {title}
            </span>
            {$status}
          </h2>,
        );
      }
      return reduced.concat(add);
    }, []);

    if (full) {
      $content.push(
        <h2 key='moreData'>More data on <strong>https://health.graphics/quantum</strong>. Ask questions in <strong>#quantum</strong> (IRC & Slack)</h2>,
      );
    }

    document.body.classList[full ? 'add' : 'remove']('summary-fullscreen');

    const $dashboard = (
      <Dashboard
        title='Quantum'
        subtitle='Release Criteria Report'
        className={cx('summary')}
        sourceTitle='Status Spreadsheet'
        source='https://docs.google.com/spreadsheets/d/1UMsy_sZkdgtElr2buwRtABuyA3GY6wNK_pfF01c890A/view'
        link='https://mana.mozilla.org/wiki/display/PM/Quantum+Release+Criteria'
      >
        {$content}
      </Dashboard>
    );

    return $dashboard;
  }
}

QuantumIndex.propTypes = {
  location: PropTypes.object,
};
