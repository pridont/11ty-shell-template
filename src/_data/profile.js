/**
 * Who the site belongs to. The single place to change the name, role, and
 * institution — base.njk builds every <title> and og:title from these rather than
 * repeating them, and site.js deliberately carries no title of its own.
 *
 * A few fields hold inline HTML (`headline`, `about.body`) and are rendered with
 * `| safe`, so treat them as markup, not text.
 */
export default {
  name: "Evelyn Hart",
  nameLines: ["Evelyn", "Hart"],
  role: "Professor of Philosophy",
  institution: "UC Berkeley",
  email: "ehart@berkeley.edu",

  cv: {
    label: "Download CV",
    url: "/assets/cv.pdf",
  },

  home: {
    headline:
      'I study how <span class="accent">attention</span> shapes the moral life — the small acts of perception and habit that quietly author who we become.',
    lede: "My work sits between ethics, moral psychology, and the philosophy of perception. I also write, more plainly, for anyone curious about the shape of an ordinary good life.",
  },

  about: {
    body: [
      "Evelyn Hart is a Professor of Philosophy at the University of California, Berkeley, where she has taught since 2014. Her research asks how perception and attention figure in the moral life — how we come to see a situation as calling for one response rather than another.",
      "She is the author of <em>The Weight of Small Acts</em> (Oxford, 2022) and writes regularly for a general audience. Before Berkeley she held a research fellowship at the University of Toronto.",
    ],
    areas: ["Ethics", "Moral psychology", "Philosophy of perception"],
    education: [
      { year: "2011", text: "Ph.D. Philosophy, Princeton" },
      { year: "2006", text: "B.A. Philosophy, Toronto" },
    ],
  },

  contact: {
    intro:
      "The best way to reach me is by email. I read everything, though replies can be slow during term.",
    rows: [
      {
        label: "Email",
        value: "ehart@berkeley.edu",
        href: "mailto:ehart@berkeley.edu",
      },
      { label: "Office", value: "314 Moses Hall, UC Berkeley" },
      { label: "Hours", value: "Tuesdays, 2–4pm (term)" },
      { label: "Mail", value: "Dept. of Philosophy, Berkeley CA 94720" },
    ],
    links: [
      { label: "Google Scholar", url: "https://scholar.google.com/" },
      { label: "PhilPapers", url: "https://philpapers.org/" },
    ],
  },
};
