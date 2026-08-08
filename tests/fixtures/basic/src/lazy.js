import "./lazy.css";

export function mount() {
  const el = document.createElement("div");
  el.className = "lazy-style-marker";
  document.body.append(el);
}
