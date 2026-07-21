// Theme toggle. The <head> script has already set an explicit data-theme; this only
// flips it and persists the choice. querySelectorAll because the toggle renders twice
// (desktop sidebar + mobile menu).
document.querySelectorAll("[data-theme-toggle]").forEach(function (btn) {
  btn.addEventListener("click", function () {
    var root = document.documentElement;
    var next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
    root.setAttribute("data-theme", next);
    try {
      localStorage.setItem("theme", next);
    } catch (e) {}
  });
});

// Mobile menu.
(function () {
  var menu = document.getElementById("mobile-menu");
  if (!menu) return;

  var toggles = document.querySelectorAll("[data-menu-toggle]");

  function setOpen(open) {
    menu.hidden = !open;
    document.body.classList.toggle("is-menu-open", open);
    toggles.forEach(function (t) {
      t.setAttribute("aria-expanded", String(open));
    });
    if (open) {
      var first = menu.querySelector("a, button");
      if (first) first.focus();
    }
  }

  toggles.forEach(function (t) {
    t.addEventListener("click", function () {
      setOpen(menu.hidden);
    });
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && !menu.hidden) {
      setOpen(false);
      var opener = document.querySelector(".hamburger");
      if (opener) opener.focus();
    }
  });

  // A link inside the overlay navigates away; close so the state is not restored on
  // back-navigation from bfcache.
  menu.querySelectorAll("a").forEach(function (a) {
    a.addEventListener("click", function () {
      setOpen(false);
    });
  });
})();
