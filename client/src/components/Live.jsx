import { useState, useEffect, useRef } from 'react';
import PixelRobot from './PixelRobot';
import PixelBox from './PixelBox';
import { startAnimation, defaultCuts, DEFAULT_ANIM_CONFIG } from '../utils/pixelChar';
import './Live.css';

const GUEST_UIDS = ['59718320605', '65377146175', '14045173949'];

const ROBOT_COLORS = [
  { head: '#143050', body: '#205080', leg: '#102440' },
  { head: '#521815', body: '#8e3530', leg: '#3e100e' },
  { head: '#888878', body: '#aaa898', leg: '#666656' },
];

const SELF_ROBOT = { head: '#265c2e', body: '#37753f', leg: '#1e4824' };

// ── 用户像素角色：有 avatar 时跑透明背景动画，否则退回 PixelRobot ──
function PlayerAvatar({ avatarGrid, avatarCuts, robotColors, isSelf, size = 80 }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current || !avatarGrid || !avatarCuts) return;
    const cuts = avatarCuts.length === 3 ? avatarCuts : defaultCuts(avatarGrid.length);
    const cfg = { ...DEFAULT_ANIM_CONFIG, cuts };
    // transparent=true：不画棋盘格，canvas 背景保持透明
    const stop = startAnimation(canvasRef.current, avatarGrid, cfg, size, true);
    return stop;
  }, [avatarGrid, avatarCuts, size]);

  if (!avatarGrid) {
    const colors = robotColors ?? (isSelf ? SELF_ROBOT : ROBOT_COLORS[0]);
    return <PixelRobot {...colors} width={size} height={Math.round(size * 1.25)} />;
  }

  return <canvas ref={canvasRef} style={{ imageRendering: 'pixelated', display: 'block' }} />;
}

function Avatar({ src, displayName, className = '' }) {
  const initials = displayName?.slice(0, 2).toUpperCase() ?? '?';
  if (src) return <img src={src} alt={displayName} className={`live-av live-av-img ${className}`} />;
  return <div className={`live-av ${className}`}>{initials}</div>;
}

function pctClass(pct) {
  if (pct === 100) return 'done';
  if (pct < 30) return 'urgent';
  if (pct < 60) return 'warn';
  return '';
}

function HistoryList({ items }) {
  return (
    <div>
      {items.map(h => (
        <div key={h.id} className="live-history-item">
          <div className={`live-history-av ${h.avClass}`}>{h.initials}</div>
          <div className="live-history-text"><strong>{h.who}</strong> {h.text}</div>
          <div className="live-history-time">{h.time}</div>
        </div>
      ))}
    </div>
  );
}

function AddTaskModal({ onClose, onPick, selectedIds, tasks }) {
  const formatDue = (d) => {
    if (!d) return 'no due date';
    const due = new Date(d);
    const now = new Date();
    const diff = due - now;
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (diff < 0) return 'overdue';
    if (hours < 24) return `due in ${hours}h`;
    if (days === 1) return 'due tomorrow';
    if (days <= 7) return `due in ${days}d`;
    return `due ${due.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
  };
  const available = tasks.filter(t => {
    const done = t.progressNumerator >= t.progressDenominator && t.progressDenominator > 0;
    return !done && !selectedIds.includes(t._id);
  });
  return (
    <div className="live-modal-backdrop" onClick={onClose}>
      <PixelBox variant="retro" className="live-modal" onClick={e => e.stopPropagation()}>
        <div className="live-modal-header">
          <div className="live-modal-title">Add Task</div>
          <button type="button" className="live-modal-close" onClick={onClose}>
            <img src="https://s3-us-west-2.amazonaws.com/s.cdpn.io/217233/scrapCross.png" alt="" width="15" height="15" />
          </button>
        </div>
        <div className="live-modal-body">
          {available.length === 0 ? <div className="live-modal-empty">No available tasks.</div>
            : available.map(t => {
              const num = t.progressNumerator ?? 0, den = t.progressDenominator ?? 0;
              const course = t.course?.courseCode;
              return (
                <button key={t._id} type="button" className="live-modal-task" onClick={() => onPick(t)}>
                  <div className="live-modal-task-top">
                    <span className="live-modal-task-name">{t.title}</span>
                    {den > 0 && <span className="live-modal-task-frac">{num}/{den}</span>}
                  </div>
                  <div className="live-modal-task-meta">
                    <span>{formatDue(t.dueDate)}</span>
                    {course && <><span className="live-modal-task-dot">·</span><span>{course}</span></>}
                  </div>
                </button>
              );
            })}
        </div>
      </PixelBox>
    </div>
  );
}

function SelfPanel({ tasks, roomTasks, onAddTask, onRemoveTask }) {
  const [showModal, setShowModal] = useState(false);
  const [menuFor, setMenuFor] = useState(null);
  useEffect(() => {
    if (!menuFor) return;
    const onDocClick = () => setMenuFor(null);
    const t = setTimeout(() => document.addEventListener('click', onDocClick), 0);
    return () => { clearTimeout(t); document.removeEventListener('click', onDocClick); };
  }, [menuFor]);
  return (
    <>
      <div>
        <div className="live-task-section-title">My Tasks</div>
        {roomTasks.length === 0 && <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 12, color: 'var(--muted)' }}>No tasks added to this room yet.</div>}
        {roomTasks.map(t => {
          const pct = t.progressDenominator ? Math.round(t.progressNumerator / t.progressDenominator * 100) : 0;
          return (
            <div key={t._id} className="live-task-row">
              <div className="live-task-label">
                <span className="live-task-name">{t.title}</span>
                <span className="live-task-pct-wrap">
                  <span className="live-task-pct">{pct}%</span>
                  <button type="button" className="live-task-menu-btn" onClick={e => { e.stopPropagation(); setMenuFor(prev => prev === t._id ? null : t._id); }}>
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor"><circle cx="3" cy="7" r="1.3" /><circle cx="7" cy="7" r="1.3" /><circle cx="11" cy="7" r="1.3" /></svg>
                  </button>
                  {menuFor === t._id && (
                    <PixelBox variant="retro" className="live-task-menu" onClick={e => e.stopPropagation()}>
                      <button type="button" className="live-task-menu-item" onClick={() => { onRemoveTask(t._id); setMenuFor(null); }}>Remove from room</button>
                    </PixelBox>
                  )}
                </span>
              </div>
              <input className="live-task-slider" type="range" min="0" max="100" value={pct} readOnly />
            </div>
          );
        })}
        <button className="live-add-task-btn" onClick={() => setShowModal(true)}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><line x1="6" y1="1" x2="6" y2="11" /><line x1="1" y1="6" x2="11" y2="6" /></svg>
          add task
        </button>
      </div>
      <div><div className="live-task-section-title">History</div><HistoryList items={[]} /></div>
      {showModal && <AddTaskModal onClose={() => setShowModal(false)} onPick={task => { onAddTask(task); setShowModal(false); }} selectedIds={roomTasks.map(t => t._id)} tasks={tasks} />}
    </>
  );
}

function MemberPanel({ member }) {
  return (
    <>
      <div>
        <div className="live-task-section-title">Tasks</div>
        {member.tasks.length === 0 && <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 12, color: 'var(--muted)' }}>No tasks added to this room yet.</div>}
        {member.tasks.map(t => {
          const pct = t.progressDenominator ? Math.round(t.progressNumerator / t.progressDenominator * 100) : 0;
          const pc = pctClass(pct);
          return (
            <div key={t._id} className="live-task-row">
              <div className="live-task-label"><span className="live-task-name">{t.title}</span><span className={`live-task-pct ${pc}`}>{pct}%</span></div>
              <div className="live-task-bar"><div className={`live-task-bar-fill ${pc}`} style={{ width: `${pct}%` }} /></div>
            </div>
          );
        })}
      </div>
      <div><div className="live-task-section-title">History</div><HistoryList items={[]} /></div>
    </>
  );
}

function OverallPanel({ allMembers }) {
  return (
    <div>
      <div className="live-task-section-title">Overall Progress</div>
      {allMembers.map(m => {
        const tasks = m.tasks ?? [];
        const avg = tasks.length ? Math.round(tasks.reduce((s, t) => s + (t.progressDenominator ? t.progressNumerator / t.progressDenominator * 100 : 0), 0) / tasks.length) : 0;
        const pc = pctClass(avg);
        return (
          <div key={m.uid || m._id} className="live-task-row">
            <div className="live-task-label"><span className="live-task-name">{m.displayName}</span><span className={`live-task-pct ${pc}`}>{avg}%</span></div>
            <div className="live-task-bar"><div className={`live-task-bar-fill ${pc}`} style={{ width: `${avg}%` }} /></div>
          </div>
        );
      })}
      <div style={{ marginTop: 20 }}><div className="live-task-section-title">All Activity</div><HistoryList items={[]} /></div>
    </div>
  );
}

function getDominantColor(imgEl) {
  const canvas = document.createElement('canvas');
  canvas.width = 50; canvas.height = 50;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(imgEl, 0, 0, 50, 50);
  const data = ctx.getImageData(0, 0, 50, 50).data;
  const counts = {};
  for (let i = 0; i < data.length; i += 4) {
    const key = `${Math.round(data[i]/32)*32},${Math.round(data[i+1]/32)*32},${Math.round(data[i+2]/32)*32}`;
    counts[key] = (counts[key] || 0) + 1;
  }
  const [r, g, b] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0].split(',');
  return `rgb(${r},${g},${b})`;
}

const API = import.meta.env.VITE_API_URL;

export default function Live() {
  const [selected, setSelected] = useState('self');
  const [self, setSelf] = useState(null);
  const [selfProfile, setSelfProfile] = useState(null);
  const [selfTasks, setSelfTasks] = useState([]);
  const [roomTasks, setRoomTasks] = useState([]);
  const [members, setMembers] = useState([]);
  const [badgeColor, setBadgeColor] = useState('var(--green)');
  const [badgeShadow, setBadgeShadow] = useState('rgba(45,138,62,0.2)');
  const badgeImgRef = useRef(null);

  const badgeSrc = (selected === 'overall' || selected === 'self')
    ? (self?.avatar ?? null)
    : members.find(m => m.uid === selected)?.avatar ?? null;

  useEffect(() => {
    if (!badgeSrc) { setBadgeColor('var(--green)'); setBadgeShadow('rgba(45,138,62,0.2)'); return; }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const color = getDominantColor(img);
        setBadgeColor(color);
        const match = color.match(/\d+/g);
        if (match) setBadgeShadow(`rgba(${match[0]},${match[1]},${match[2]},0.35)`);
      } catch(e) {}
    };
    img.src = badgeSrc;
  }, [badgeSrc]);

  useEffect(() => {
    fetch(`${API}/api/auth/me`, { credentials: 'include' }).then(r => r.json()).then(setSelf);
    fetch(`${API}/api/profile`, { credentials: 'include' }).then(r => r.json()).then(setSelfProfile);
    fetch(`${API}/api/tasks`, { credentials: 'include' }).then(r => r.json()).then(setSelfTasks);
    Promise.all(GUEST_UIDS.map(uid =>
      fetch(`${API}/api/profile/${uid}`, { credentials: 'include' }).then(r => r.json())
    )).then(profiles => setMembers(profiles.map((p, i) => ({ ...p, robot: ROBOT_COLORS[i], tasks: [] }))));
  }, []);

  const allMembers = self
    ? [{ ...self, profile: selfProfile, robot: SELF_ROBOT, tasks: roomTasks }, ...members]
    : members;

  const panelMember = members.find(m => m.uid === selected);
  const selfInitials = self?.displayName?.slice(0, 2).toUpperCase() ?? '...';
  const badgeInitials = (selected === 'self' || selected === 'overall')
    ? selfInitials
    : panelMember?.displayName?.slice(0, 2).toUpperCase() ?? '??';

  if (!self) return null;

  return (
    <div className={`live-page${selected === null ? ' panel-hidden' : ''}`}>
      <div className="live-main">
        <PixelBox variant="retro" className="live-header">
          <div className="live-room-name">AIT · final crunch room</div>
          <div className="live-meta">
            <span className="live-meta-badge"><div className="live-dot" />4 studying</span>
            <span>session 2h 47m</span>
          </div>
        </PixelBox>

        <div className="live-stage">
          <PixelBox variant="retro" className="live-canvas">
            <div className="live-canvas-placeholder">
              <div className="live-canvas-figures">
                {allMembers.map((m, i) => {
                  const avatar = i === 0 ? selfProfile?.activeAvatar : m.activeAvatar;
                  const size = i === 0 ? 100 : 80;
                  return (
                    <div key={m.uid || 'self'} className="live-figure">
                      <PlayerAvatar
                        avatarGrid={avatar?.avatarGrid ?? null}
                        avatarCuts={avatar?.avatarCuts ?? null}
                        robotColors={m.robot}
                        isSelf={i === 0}
                        size={size}
                      />
                      <div className="live-canvas-label">{m.displayName}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </PixelBox>

          <div className="live-members-row">
            <div className="live-members">
              <PixelBox variant="retro" className={`live-member-card is-self${selected === 'self' ? ' active' : ''}`} onClick={() => setSelected(p => p === 'self' ? null : 'self')}>
                <Avatar src={self.avatar} displayName={self.displayName} className="av-g" />
                <span className="live-member-name">{self.displayName}</span>
                <span className="live-member-pct">
                  {roomTasks.length ? Math.round(roomTasks.reduce((s, t) => s + (t.progressDenominator ? t.progressNumerator / t.progressDenominator * 100 : 0), 0) / roomTasks.length) : 0}%
                </span>
              </PixelBox>
              {members.map(m => (
                <PixelBox key={m.uid} variant="retro" className={`live-member-card${selected === m.uid ? ' active' : ''}`} onClick={() => setSelected(p => p === m.uid ? null : m.uid)}>
                  <Avatar src={m.avatar} displayName={m.displayName} />
                  <span className="live-member-name">{m.displayName}</span>
                  <span className="live-member-pct">—</span>
                </PixelBox>
              ))}
            </div>
            <PixelBox as="button" variant="retro" className={`live-member-overall-btn${selected === 'overall' ? ' active' : ''}`} onClick={() => setSelected(p => p === 'overall' ? null : 'overall')}>
              Overall
            </PixelBox>
          </div>
        </div>
      </div>

      <PixelBox variant="retro" className={`live-panel${selected === null ? ' hidden' : ''}`}>
        <PixelBox variant="retro" className="live-panel-badge" style={{ '--pixel-border-color': badgeColor, '--pixel-shadow': badgeShadow }}>
          {badgeSrc ? <img ref={badgeImgRef} src={badgeSrc} alt="badge" className="live-panel-badge-img" crossOrigin="anonymous" /> : badgeInitials}
        </PixelBox>
        <button type="button" className="live-panel-close" onClick={() => setSelected(null)}>
          <img src="https://s3-us-west-2.amazonaws.com/s.cdpn.io/217233/scrapCross.png" alt="" width="15" height="15" />
        </button>
        {selected !== null && (
          <>
            <div className="live-panel-header">
              <div className="live-panel-who">
                {selected === 'overall' ? <div className="live-panel-name">Overall</div>
                  : selected === 'self' ? <div className="live-panel-name">{self.displayName}</div>
                  : panelMember && <div className="live-panel-name">{panelMember.displayName}</div>}
              </div>
              <div className="live-panel-mode">
                {selected === 'overall' ? 'all members' : selected === 'self' ? 'your progress' : 'viewing'}
              </div>
            </div>
            <div className="live-panel-body">
              {selected === 'self'    && <SelfPanel tasks={selfTasks} roomTasks={roomTasks} onAddTask={task => setRoomTasks(prev => [...prev, task])} onRemoveTask={id => setRoomTasks(prev => prev.filter(t => t._id !== id))} />}
              {selected === 'overall' && <OverallPanel allMembers={allMembers} />}
              {panelMember            && <MemberPanel member={panelMember} />}
            </div>
          </>
        )}
      </PixelBox>
    </div>
  );
}
