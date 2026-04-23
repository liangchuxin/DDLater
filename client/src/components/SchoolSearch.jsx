import { useState, useEffect, useRef } from "react";

export default function SchoolSearch({ value, onChange, onConfirmChange }) {
  const [query, setQuery] = useState(value || "");
  const [results, setResults] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [confirmed, setConfirmed] = useState(!!value); // initial value treated as confirmed
  const debounceRef = useRef(null);

  useEffect(() => {
    setQuery(value || "");
    setConfirmed(!!value);
  }, [value]);

  const handleInput = (e) => {
    const val = e.target.value;
    setQuery(val);

    if (confirmed) {
      setConfirmed(false);
      onConfirmChange?.(false);
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (val.length < 2) {
      setResults([]);
      setShowDropdown(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/api/universities?name=${encodeURIComponent(val)}`,
      );
      const data = await res.json();
      setResults(data.slice(0, 8));
      setShowDropdown(true);
    }, 400);
  };

  const handleSelect = (name) => {
    setQuery(name);
    setConfirmed(true);
    onConfirmChange?.(true);
    onChange(name);
    setResults([]);
    setShowDropdown(false);
  };

  return (
    <div className="ps-school-wrap">
      <input
        className="ps-input"
        type="text"
        value={query}
        onChange={handleInput}
        placeholder="Search your school…"
        onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
      />
      {showDropdown && results.length > 0 && (
        <ul className="ps-school-dropdown">
          {results.map((u) => (
            <li key={u.name} onMouseDown={() => handleSelect(u.name)}>
              {u.name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
