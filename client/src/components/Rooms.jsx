import { useState } from 'react';
import RoomCard from './RoomCard';
import { ROOMS, ROOM_FILTERS } from './roomsData';

export default function Rooms() {
  const [activeFilter, setActiveFilter] = useState('All Rooms');

  return (
    <div className="rooms-page main">
      <div className="main-inner">
        <div className="sec-head">
          <div className="sec-title">Study Rooms · join someone and get it done</div>
        </div>
        <div className="filter-bar">
          {ROOM_FILTERS.map((f) => (
            <button
              key={f}
              className={[
                'chip',
                activeFilter === f ? 'on' : '',
                f.startsWith('🔥') ? 'fire' : '',
              ].filter(Boolean).join(' ')}
              onClick={() => setActiveFilter(f)}
            >
              {f}
            </button>
          ))}
        </div>
        <div className="rooms-grid">
          {ROOMS.map((room) => (
            <RoomCard key={room.id} room={room} />
          ))}
          <div className="rcard rcard-create">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none"
              stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"
              style={{ color: 'var(--muted)' }}>
              <line x1="10" y1="4" x2="10" y2="16" />
              <line x1="4"  y1="10" x2="16" y2="10" />
            </svg>
            <div className="rcard-create-label">Create a room</div>
            <div className="rcard-create-sub">Invite people working on the same thing</div>
          </div>
        </div>
      </div>
    </div>
  );
}
