import "./style.css";

document.querySelector("#app").textContent = "main";

document.querySelector("#app").addEventListener("click", async () => {
  const { mount } = await import("./lazy.js");
  mount();
});
