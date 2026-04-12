import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import SchoolSearch from "./SchoolSearch";
import CourseSearch from "./CourseSearch";
import "./ManageTask.css";

const VISIBILITY_OPTIONS = [
  { value: "public", label: "Visible to all" },
  { value: "school", label: "Hidden from classmates" },
  { value: "private", label: "Private" },
];

function TaskForm({
  initialData,
  onSubmit,
  submitLabel,
  pageTitle,
  defaultSchool,
  onDelete,
  readonlySchool,
}) {
  const navigate = useNavigate();
  const [title, setTitle] = useState(initialData?.title ?? "");
  const [description, setDescription] = useState(
    initialData?.description ?? "",
  );
  const [dueDate, setDueDate] = useState(
    initialData?.dueDate
      ? new Date(initialData.dueDate).toISOString().slice(0, 16)
      : "",
  );
  const [course, setCourse] = useState(
    initialData?.course?.courseCode ?? initialData?.course ?? "",
  );
  const [school, setSchool] = useState(
    initialData?.course?.school ?? initialData?.school ?? "",
  );
  const [progressDone, setDone] = useState(initialData?.progressNumerator ?? 0);
  const [progressTotal, setTotal] = useState(
    initialData?.progressDenominator ?? 1,
  );
  const [visibility, setVisibility] = useState(
    initialData?.hideFromClassmates ? "school" : "public",
  );
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) {
      setError("Title is required.");
      return;
    }
    if (Number(progressDone) > Number(progressTotal)) {
      setError("Progress cannot exceed total.");
      return;
    }
    setError("");
    await onSubmit({
      title,
      description,
      dueDate: dueDate ? new Date(dueDate).toISOString() : "",
      course,
      school,
      progressNumerator: Number(progressDone),
      progressDenominator: Number(progressTotal),
      hideFromClassmates: visibility === "school",
      private: visibility === "private",
    });
  };

  return (
    <main className="main">
      <div className="main-inner" style={{ position: "relative" }}>
        <button className="mt-back-btn" onClick={() => navigate("/tasks")}>
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="10,3 4,8 10,13" />
          </svg>
          Back to tasks
        </button>
        <div className="mt-form-title">{pageTitle}</div>

        <form onSubmit={handleSubmit}>
          <div className="mt-form-layout">
            {/* ── 左列: 主要字段 ── */}
            <div className="mt-form-col">
              <div className="mt-field">
                <input
                  className="mt-input"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="task title"
                />
              </div>

              <div className="mt-field">
                <textarea
                  className="mt-textarea"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="description (optional)"
                />
              </div>

              <div className="mt-field">
                <div className="mt-date-row">
                  <span className="mt-date-label">due date</span>
                  <input
                    className="mt-input mt-date-input"
                    type="datetime-local"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                  />
                </div>
              </div>

              <div className="mt-field">
                {readonlySchool ? (
                  <div className="mt-school-readonly">{course || "—"}</div>
                ) : (
                  <CourseSearch
                    value={course}
                    onChange={(val) => setCourse(val)}
                    school={school}
                  />
                )}
              </div>

              <div className="mt-field">
                {readonlySchool ? (
                  <div className="mt-school-readonly">
                    {school || "Unspecified"}
                  </div>
                ) : (
                  <>
                    <SchoolSearch
                      value={school}
                      onChange={(val) => setSchool(val)}
                      onConfirmChange={() => {}}
                    />
                    {defaultSchool && (
                      <div
                        className="mt-school-badge"
                        onClick={() => setSchool(defaultSchool)}
                      >
                        {defaultSchool}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* ── 右列: Progress + Visibility + Submit ── */}
            <div className="mt-form-col">
              <div className="mt-field">
                <div className="mt-field-label">Progress</div>
                <div className="mt-progress-row">
                  <input
                    className="mt-input"
                    type="number"
                    min="0"
                    max={progressTotal}
                    value={progressDone}
                    onChange={(e) =>
                      setDone(Math.min(Number(e.target.value), progressTotal))
                    }
                    placeholder="done"
                  />
                  <span className="mt-progress-sep">/</span>
                  <input
                    className="mt-input"
                    type="number"
                    min="1"
                    value={progressTotal}
                    onChange={(e) => setTotal(Number(e.target.value))}
                    placeholder="total"
                  />
                </div>
                <div className="mt-field-hint">
                  e.g. 3 chapters done out of 8
                </div>
                <div className="mt-prog-visual">
                  <input
                    className="mt-prog-slider"
                    type="range"
                    min="0"
                    max={progressTotal}
                    value={progressDone}
                    onChange={(e) => setDone(Number(e.target.value))}
                  />
                  <span className="mt-prog-visual-label">
                    {progressDone} / {progressTotal}
                  </span>
                </div>
              </div>

              <div className="mt-field">
                <div className="mt-field-label">Visibility</div>
                <div className="mt-vis-group">
                  {VISIBILITY_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      className={`mt-vis-chip${visibility === opt.value ? " selected" : ""}`}
                      onClick={() => setVisibility(opt.value)}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <button type="submit" className="mt-submit-btn">
                {submitLabel}
              </button>
              {onDelete && (
                <button
                  type="button"
                  className="mt-delete-btn"
                  onClick={() => {
                    if (
                      window.confirm(
                        "Are you sure you want to delete this task?",
                      )
                    ) {
                      onDelete();
                    }
                  }}
                >
                  Delete Task
                </button>
              )}
              {error && <div className="mt-error">{error}</div>}
            </div>
          </div>
        </form>
      </div>
    </main>
  );
}

export function AddTask() {
  const navigate = useNavigate();
  const [defaultSchool, setDefaultSchool] = useState("");

  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL}/api/profile`, {
      credentials: "include",
    })
      .then((res) => res.json())
      .then((data) => setDefaultSchool(data.school ?? ""));
  }, []);

  const handleSubmit = async (data) => {
    const res = await fetch(`${import.meta.env.VITE_API_URL}/api/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(data),
    });
    if (res.ok) navigate("/tasks");
  };

  return (
    <TaskForm
      onSubmit={handleSubmit}
      submitLabel="Create Task"
      pageTitle="Add a Task"
      defaultSchool={defaultSchool}
    />
  );
}

export function EditTask() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [task, setTask] = useState(null);
  const [defaultSchool, setDefaultSchool] = useState("");

  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL}/api/tasks/${id}`, {
      credentials: "include",
    })
      .then((res) => res.json())
      .then((data) => setTask(data));
    fetch(`${import.meta.env.VITE_API_URL}/api/profile`, {
      credentials: "include",
    })
      .then((res) => res.json())
      .then((data) => setDefaultSchool(data.school ?? ""));
  }, [id]);

  const handleSubmit = async (data) => {
    const res = await fetch(`${import.meta.env.VITE_API_URL}/api/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(data),
    });
    if (res.ok) navigate("/tasks");
  };

  const handleDelete = async () => {
    await fetch(`${import.meta.env.VITE_API_URL}/api/tasks/${id}`, {
      method: "DELETE",
      credentials: "include",
    });
    navigate("/tasks");
  };

  if (!task)
    return (
      <main className="main">
        <div
          className="main-inner"
          style={{
            fontFamily: "'DM Mono',monospace",
            fontSize: 13,
            color: "var(--muted)",
          }}
        >
          Loading…
        </div>
      </main>
    );

  return (
    <TaskForm
      initialData={task}
      onSubmit={handleSubmit}
      onDelete={handleDelete}
      submitLabel="Save Changes"
      pageTitle="Edit Task"
      defaultSchool={defaultSchool}
      readonlySchool
    />
  );
}
