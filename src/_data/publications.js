/**
 * Publications, newest first.
 *
 * `type` is what publications.njk splits on via the `whereType` filter — adding a
 * new type means adding a section there too. `pdf` is optional; omitting it hides
 * the PDF link rather than rendering a dead one.
 */
export default [
  {
    type: "article",
    authors: "Doe, J.",
    year: "2024",
    title: "Moral Attention and the Ethics of Perception",
    venue: "Journal of Ethics 28(3), 401–429",
    pdf: "#",
  },
  {
    type: "book",
    authors: "Doe, J.",
    year: "2022",
    title: "The Weight of Small Acts: Essays on Everyday Ethics",
    venue: "Oxford University Press",
  },
  {
    type: "article",
    authors: "Doe, J. & Nguyen, T.",
    year: "2021",
    title: "Agency Without Deliberation",
    venue: "Mind 130(518), 511–540",
    pdf: "#",
  },
  {
    type: "article",
    authors: "Doe, J.",
    year: "2019",
    title: "Habit, Skill, and the Shape of a Life",
    venue: "Philosophy & Phenomenological Research 99(2), 223–248",
    pdf: "#",
  },
];
