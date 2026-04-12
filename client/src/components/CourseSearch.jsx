import { useState, useEffect, useRef } from 'react';

export default function CourseSearch({ value, onChange, school }) {
  const [query, setQuery] = useState(value || '');
  const [results, setResults] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const debounceRef = useRef(null);

  useEffect(() => {
    setQuery(value || '');
  }, [value]);

  const handleInput = (e) => {
    const val = e.target.value;
    setQuery(val);
    onChange(val);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (val.length < 1) {
      setResults([]);
      setShowDropdown(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      const params = new URLSearchParams({ q: val });
      if (school) params.append('school', school);
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/api/courses/search?${params}`,
        { credentials: 'include' }
      );
      const data = await res.json();
      setResults(data);
      setShowDropdown(data.length > 0);
    }, 300);
  };

  const handleSelect = (course) => {
    const label = course.courseCode + (course.courseName ? ` – ${course.courseName}` : '');
    setQuery(label);
    onChange(label);
    setResults([]);
    setShowDropdown(false);
  };

  return (
    <div className="ps-school-wrap">
      <input
        className="mt-input"
        type="text"
        value={query}
        onChange={handleInput}
        placeholder="course (e.g. CSCI-UA 467)"
        onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
      />
      {showDropdown && (
        <ul className="ps-school-dropdown">
          {results.map((c) => (
            <li key={c._id} onMouseDown={() => handleSelect(c)}>
              <span>{c.courseCode}</span>
              {c.courseName && <span style={{ color: 'var(--muted)', marginLeft: 8 }}>{c.courseName}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
