import { useState } from 'react';
import TaskCard from './TaskCard';

// TODO: 之后替换成 API 数据
const SAMPLE_TASKS = [
  // ROW 1
  { id: 1, course: 'AIT', courseTag: 't-ait', bgClass: 'ci-1', dotStatus: 'on',
    robot: { head: '#265c2e', body: '#37753f', leg: '#1e4824' },
    initials: 'CL', avClass: 'av-g', username: 'celia', dept: 'NYU CS',
    task: 'Milestone 3', progressText: '3 / 8', percent: 35, pfClass: 'pf-g',
    ddlText: '6d left', ddlClass: 'ddl-s', active: true },
  { id: 2, course: 'SE', courseTag: 't-se', bgClass: 'ci-2', dotStatus: 'on',
    robot: { head: '#5e3015', body: '#a05530', leg: '#4a2410' },
    initials: 'MX', username: 'mingxuan', dept: 'NYU CS',
    task: 'Project 3 — Ghosty', progressText: '6 / 10', percent: 60, pfClass: 'pf-y',
    ddlText: 'due in 14h', ddlClass: 'ddl-u', active: true },
  { id: 3, course: 'BD', courseTag: 't-bd', bgClass: 'ci-3', dotStatus: 'recent',
    robot: { head: '#143050', body: '#205080', leg: '#102440' },
    initials: 'JW', username: 'jingwen', dept: 'NYU DS',
    task: 'BD Final Project', progressText: '8 / 10', percent: 80, pfClass: 'pf-g',
    ddlText: '12d left', ddlClass: 'ddl-o' },
  { id: 4, course: 'WD', courseTag: 't-wd', bgClass: 'ci-4', dotStatus: 'off',
    robot: { head: '#3c1455', body: '#6830a0', leg: '#2e0e40' },
    initials: 'SY', username: 'siyu', dept: 'NYU Math',
    task: 'HW5 — Responsive', progressText: 'done ✓', percent: 100, pfClass: 'pf-g',
    ddlText: 'submitted', ddlClass: 'ddl-o' },
  // ROW 2 — wide LEFT
  { id: 5, course: 'SE', courseTag: 't-se', bgClass: 'ci-6', dotStatus: 'on',
    robot: { head: '#521815', body: '#8e3530', leg: '#3e100e' },
    robot2: { head: '#443010', body: '#785030', leg: '#342008' },
    initials: 'RZ', avClass: 'av-r', username: 'ruoze', dept: 'NYU CS',
    task: 'Project 3 — Ghosty Package', progressText: '2 / 10', percent: 20, pfClass: 'pf-r',
    ddlText: 'due tonight · 23:59', ddlClass: 'ddl-u', wide: true, active: true },
  { id: 6, course: 'AIT', courseTag: 't-ait', bgClass: 'ci-5', dotStatus: 'recent',
    robot: { head: '#14382a', body: '#326050', leg: '#0e2a1e' },
    initials: 'HY', avClass: 'av-g', username: 'haoyue', dept: 'NYU CS',
    task: 'HW#7 — MongoDB', progressText: 'halfway', percent: 50, pfClass: 'pf-y',
    ddlText: '3d left', ddlClass: 'ddl-s', active: true },
  { id: 7, course: 'BD', courseTag: 't-bd', bgClass: 'ci-7', dotStatus: 'on',
    robot: { head: '#103830', body: '#206058', leg: '#0a2820' },
    initials: 'WK', username: 'wenkai', dept: 'NYU CS',
    task: 'HW6 — Spark ML', progressText: '7 / 10', percent: 70, pfClass: 'pf-y',
    ddlText: 'tonight', ddlClass: 'ddl-u', active: true },
  // ROW 3 — wide RIGHT
  { id: 8, course: 'LIFE', courseTag: 't-li', bgClass: 'ci-8', dotStatus: 'recent',
    robot: { head: '#380e30', body: '#602858', leg: '#280820' },
    initials: 'LT', username: 'liting', dept: 'NYU Econ',
    task: 'Grad School Essay', progressText: 'draft 2 / 4', percent: 45, pfClass: 'pf-g',
    ddlText: '5d left', ddlClass: 'ddl-s' },
  { id: 9, course: 'BD', courseTag: 't-bd', bgClass: 'ci-9', dotStatus: 'off',
    robot: { head: '#184040', body: '#307060', leg: '#102828' },
    initials: 'SN', username: 'sinda', dept: 'NYU DS',
    task: 'AO3 Data Pipeline', progressText: 'not started', percent: 0, pfClass: 'pf-r',
    ddlText: '5d left', ddlClass: 'ddl-s' },
  { id: 10, course: 'WD', courseTag: 't-wd', bgClass: 'ci-b', dotStatus: 'recent',
    robot: { head: '#503020', body: '#907050', leg: '#382010' },
    robot2: { head: '#3c1455', body: '#6830a0', leg: '#2e0e40' },
    initials: 'LR', username: 'laura', dept: 'NYU CDS',
    task: 'WD Final Project', progressText: '5.5 / 10', percent: 55, pfClass: 'pf-g',
    ddlText: '4d left', ddlClass: 'ddl-s', wide: true },
  // ROW 4
  { id: 11, course: 'SE', courseTag: 't-se', bgClass: 'ci-a', dotStatus: 'off',
    robot: { head: '#303050', body: '#505090', leg: '#202038' },
    initials: 'KL', username: 'kairis', dept: 'NYU CS',
    task: 'SE Quiz prep', progressText: 'not started', percent: 0, pfClass: 'pf-r',
    ddlText: 'tomorrow', ddlClass: 'ddl-u' },
  { id: 12, course: 'AIT', courseTag: 't-ait', bgClass: 'ci-c', dotStatus: 'off',
    robot: { head: '#2a4820', body: '#487040', leg: '#1e3418' },
    initials: 'ZY', avClass: 'av-g', username: 'ziyang', dept: 'NYU CS',
    task: 'HW#6 — Sessions', progressText: '9 / 10', percent: 90, pfClass: 'pf-g',
    ddlText: 'submitted', ddlClass: 'ddl-o' },
  { id: 13, course: 'AIT', courseTag: 't-ait', bgClass: 'ci-5', dotStatus: 'off',
    robot: { head: '#3a2010', body: '#704030', leg: '#281408' },
    initials: 'ET', username: 'ethan', dept: 'NYU CS',
    task: 'HW#7 — Mongoose', progressText: 'not started', percent: 0, pfClass: 'pf-r',
    ddlText: '3d left', ddlClass: 'ddl-u' },
];

const FILTERS = ['Everyone', 'My School', 'My Course', 'Due Today', '0% Done'];

export default function Dashboard() {
  const [activeFilter, setActiveFilter] = useState('Everyone');

  return (
    <main className="main">
      <div className="main-inner">

        {/* Filter bar */}
        <div className="sec-head">
          <div className="sec-title">What people are working on</div>
        </div>
        <div className="filter-bar">
          {FILTERS.map((f) => (
            <button
              key={f}
              className={`chip ${activeFilter === f ? 'on' : ''} ${f === '0% Done' ? 'warn' : ''}`}
              onClick={() => setActiveFilter(f)}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Task grid */}
        <div className="grid">
          {SAMPLE_TASKS.map((t) => (
            <TaskCard key={t.id} {...t} />
          ))}

          {/* Promo card */}
          <div className="card card-promo">
            <PixelPromo />
            <div className="promo-title">Get your<br />pixel avatar!</div>
            <div className="promo-sub">COMING SOON →</div>
          </div>
        </div>

        {/* TODO: Study Rooms section */}

      </div>
    </main>
  );
}

// 绿色小人 promo
function PixelPromo() {
  return (
    <svg width="76" height="96" viewBox="0 0 13 17" style={{ imageRendering: 'pixelated', opacity: 0.5 }}>
      <rect x="3" y="0" width="7" height="5" fill="#2D8A3E" />
      <rect x="2" y="5" width="9" height="7" fill="#4CAF62" />
      <rect x="1" y="7" width="2" height="3" fill="#4CAF62" />
      <rect x="10" y="7" width="2" height="3" fill="#4CAF62" />
      <rect x="3" y="12" width="3" height="4" fill="#2D8A3E" />
      <rect x="6" y="12" width="3" height="4" fill="#2D8A3E" />
      <rect x="4" y="1" width="1" height="1" fill="#dfc070" />
      <rect x="8" y="1" width="1" height="1" fill="#dfc070" />
    </svg>
  );
}
