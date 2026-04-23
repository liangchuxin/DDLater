import FeedAvatar from './FeedAvatar';

// dotStatus: 'on' | 'recent' | 'off'
// ddlClass:  'ddl-u' | 'ddl-s' | 'ddl-o'
// pfClass:   'pf-g' | 'pf-y' | 'pf-r'
// wide:      span 2 columns
// active:    green left border + light bg

export default function FeedCard({
  course,       // e.g. 'AIT'
  courseTag,    // CSS class e.g. 't-ait'
  bgClass,      // card-img bg e.g. 'ci-1'
  dotStatus,    // 'on' | 'recent' | 'off'
  avatarGrid,   // user's avatar grid
  initials,     // avatar initials e.g. 'CL'
  avClass = '', // extra av class e.g. 'av-g'
  username,
  dept,
  task,
  progressText, // left side e.g. '3 / 8'
  percent,      // e.g. 35
  pfClass,      // progress fill color
  ddlText,
  ddlClass,
  wide = false,
  active = false,
}) {
  const dotClass = dotStatus === 'on' ? 'd-on' : dotStatus === 'recent' ? 'd-re' : 'd-off';

  return (
    <div className={`card ${wide ? 'wide' : ''} ${active ? 'active' : ''}`}>
      <div className={`card-img ${bgClass}`}>
        <span className={`img-tag ${courseTag}`}>{course}</span>
        <div className={`img-dot ${dotClass}`}></div>
        <FeedAvatar grid={avatarGrid} />
      </div>
      <div className="card-body">
        <div className="card-who">
          <div className={`av ${avClass}`}>{initials}</div>
          <span className="who-name">{username}</span>
          <span className="who-dept">{dept}</span>
        </div>
        <div className="card-task">{task}</div>
        <div className="prog-bar">
          <div className={`prog-fill ${pfClass}`} style={{ width: `${percent}%` }}></div>
        </div>
        <div className="prog-meta">
          <span>{progressText}</span>
          <span style={percent === 0 ? { color: 'var(--red)' } : {}}>{percent}%</span>
        </div>
        <div className={`card-ddl ${ddlClass}`}>{ddlText}</div>
      </div>
    </div>
  );
}
