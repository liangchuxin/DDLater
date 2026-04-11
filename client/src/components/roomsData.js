// ── 像素小人颜色配置 ──────────────────────────────────────────────────────────
export const CHARS = {
  celia:    { head: '#265c2e', body: '#37753f', leg: '#1e4824' },
  haoyue:   { head: '#143050', body: '#205080', leg: '#102440' },
  ruoze:    { head: '#521815', body: '#8e3530', leg: '#3e100e' },
  liting:   { head: '#380e30', body: '#602858', leg: '#280820' },
  mingxuan: { head: '#888878', body: '#aaa898', leg: '#666656' },
  kairis:   { head: '#303050', body: '#505090', leg: '#202038' },
  ethan:    { head: '#3a2010', body: '#704030', leg: '#281408' },
  sinda:    { head: '#184040', body: '#307060', leg: '#102828' },
  wenkai:   { head: '#103830', body: '#206058', leg: '#0a2820' },
  laura:    { head: '#503020', body: '#907050', leg: '#382010' },
};

// ── Mock 数据（之后替换成 API）────────────────────────────────────────────────
export const ROOMS = [
  {
    id: 'ait-crunch', width: 'w4', live: true,
    course: 'AIT', courseTag: 'rhc-ait', stageBg: 'ri-1', stageSize: 'sh-full',
    name: 'final crunch room', memberCount: 5,
    title: 'milestone 3 · the big push',
    subtitle: '5 studying · session 2h 47m',
    tasks: '14 / 38', deadline: 'due in 6d', deadlineClass: 'ddl-s',
    percent: 37, progClass: '',
    footer: '37% collective · pomodoro 3/8',
    members: [
      { key: 'celia',    w: 84, h: 106, prog: '35%', progClass: '' },
      { key: 'haoyue',   w: 74, h: 94,  prog: '50%', progClass: '' },
      { key: 'ruoze',    w: 80, h: 100, prog: '20%', progClass: 'urgent' },
      { key: 'liting',   w: 72, h: 90,  prog: '45%', progClass: '' },
      { key: 'mingxuan', w: 60, h: 76,  prog: null,  afk: 'afk · 6m' },
    ],
  },
  {
    id: 'se-ghosty', width: 'w3', live: true,
    course: 'SE', courseTag: 'rhc-se', stageBg: 'ri-2', stageSize: 'sh-lg',
    name: 'ghosty · blue whale', memberCount: 3,
    title: 'blue whale · pypi prep',
    tasks: '3 / 12', deadline: 'due in 14h', deadlineClass: 'ddl-u',
    percent: 25, progClass: 'urgent',
    footer: '25% collective', footerRight: 'tonight 23:59', footerRightClass: 'ddl-u',
    sparkline: true,
    members: [
      { key: 'mingxuan', w: 76, h: 96 },
      { key: 'kairis',   w: 66, h: 84 },
      { key: 'ethan',    w: 70, h: 88 },
    ],
  },
  {
    id: 'bd-ao3', width: 'w1', live: true,
    course: 'BD', courseTag: 'rhc-bd', stageBg: 'ri-4', stageSize: 'sh-sm',
    name: 'ao3 × sensor', memberCount: 2,
    title: 'pipeline · time-series',
    tasks: 'celia + sinda', deadline: '5d', deadlineClass: 'ddl-s',
    percent: 10, progClass: 'warn',
    footer: '10% · planning', footerRight: '5d left', footerRightClass: 'ddl-s',
    members: [
      { key: 'celia', w: 68, h: 86 },
      { key: 'sinda', w: 60, h: 76 },
    ],
  },
  {
    id: 'wd-late', width: 'w2', live: true,
    course: 'WD', courseTag: 'rhc-wd', stageBg: 'ri-5', stageSize: 'sh-md',
    name: 'late night finals', memberCount: 4,
    title: 'final project · landing page',
    tasks: '4 members · 18 / 40', deadline: 'session 3h 20m', deadlineClass: '',
    percent: 45, progClass: '',
    footer: '45% collective', footerRight: '4d left', footerRightClass: 'ddl-s',
    members: [
      { key: 'laura',  w: 72, h: 90 },
      { key: 'liting', w: 64, h: 80 },
      { key: 'kairis', w: 68, h: 86 },
      { key: 'wenkai', w: 60, h: 76 },
    ],
  },
  {
    id: 'life-essays', width: 'w2', live: false, empty: true,
    course: 'LIFE', courseTag: '', stageBg: 'ri-3', stageSize: 'sh-md',
    name: 'midnight essay club', memberCount: 0,
    title: 'grad school essays',
    tasks: '0 members', deadline: 'grad apps', deadlineClass: '',
    percent: 0, progClass: '',
    footer: '→ Start a session',
    members: [],
  },
];

export const ROOM_FILTERS = ['All Rooms', 'My School', 'My Course', '🔥 Live Now · 3', 'Quiet'];
