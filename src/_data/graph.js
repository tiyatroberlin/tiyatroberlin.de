// Bütün veriyi okuyup birbirine bağlar: kişi ↔ oyun ↔ mekân ↔ gösterim.
import fs from "node:fs";
import yaml from "js-yaml";

const load = (f) => yaml.load(fs.readFileSync(new URL(f, import.meta.url), "utf8"));

export default function () {
  const db = load("./db.yaml");
  const works = load("./works.yaml");
  const texts = load("./texts.yaml");
  const bios = load("./bios.yaml");
  const extras = load("./extras.yaml");
  const projects = load("./projects.yaml");
  const soon = load("./soon.yaml");
  const today = new Date().toISOString().slice(0, 10);

  const people = Object.fromEntries(
    Object.entries(db.people).map(([slug, p]) => [slug, { slug, ...p, bio: bios[slug] || null, works: [], teaches: [], projects: [] }])
  );
  const venues = Object.fromEntries(Object.entries(db.venues).map(([slug, v]) => [slug, { slug, ...v, works: new Set(), shows: 0 }]));

  const allShows = [];
  for (const w of works) {
    if (texts[w.slug]) w.text = texts[w.slug];
    w.credits = (w.credits || []).map(([role, who]) => {
      const list = Array.isArray(who) ? who : [who];
      for (const s of list) {
        if (!people[s]) throw new Error(`Bilinmeyen kişi: ${s} (${w.slug})`);
        const pw = people[s].works;
        const ex = pw.find((x) => x.slug === w.slug);
        if (ex) { if (!ex.roles.includes(role)) ex.roles.push(role); }
        else pw.push({ slug: w.slug, title: w.title, year: w.year, roles: [role] });
      }
      return { role, people: list };
    });
    w.shows = (w.shows || []).map((s) => {
      const d = typeof s.date === "string" ? s.date : new Date(s.date).toISOString().slice(0, 10);
      const show = { ...s, date: d, work: w.slug, title: w.title, upcoming: d >= today };
      if (!venues[s.venue]) throw new Error(`Bilinmeyen mekân: ${s.venue}`);
      venues[s.venue].works.add(w.slug);
      venues[s.venue].shows++;
      allShows.push(show);
      return show;
    }).sort((a, b) => a.date.localeCompare(b.date));
    w.premiere = w.shows.find((s) => s.premiere) || w.shows[0];
    w.upcoming = w.shows.filter((s) => s.upcoming);
    w.venueList = [...new Set(w.shows.map((s) => s.venue))];
  }
  works.sort((a, b) => b.year - a.year || (b.premiere?.date || "").localeCompare(a.premiere?.date || ""));

  const iso = (d) => (typeof d === "string" ? d : new Date(d).toISOString().slice(0, 10));
  for (const c of extras.courses) c.start = iso(c.start);
  for (const c of extras.courses) for (const t of c.teachers || []) people[t].teaches.push(c.slug);
  for (const p of projects) for (const t of p.lead || []) people[t].projects.push(p.slug);
  for (const p of Object.values(people)) p.works.sort((a, b) => b.year - a.year);

  const extraShows = extras.events.map((e) => {
    const d = typeof e.date === "string" ? e.date : new Date(e.date).toISOString().slice(0, 10);
    return { ...e, date: d, upcoming: d >= today, external: true };
  });
  const program = [...allShows.filter((s) => s.upcoming), ...extraShows.filter((s) => s.upcoming)]
    .sort((a, b) => (a.date + (a.time || "")).localeCompare(b.date + (b.time || "")));

  const pm = {};
  for (const s of program) (pm[s.date.slice(0, 7)] ||= []).push(s);
  const programByMonth = Object.entries(pm).map(([m, shows]) => ({ month: m + "-01", shows }));

  const years = {};
  for (const w of works) (years[w.year] ||= []).push(w);
  const yearList = Object.keys(years).sort().map((y) => ({ year: y, works: years[y] }));

  // Ağ: yalnız en az bir oyunu olan kişiler
  const active = Object.values(people).filter((p) => p.works.length && !p.org);
  const nodes = [
    ...works.map((w) => ({ id: "w:" + w.slug, slug: w.slug, label: w.title, type: "work", year: w.year })),
    ...active.map((p) => ({ id: "p:" + p.slug, slug: p.slug, label: p.name, type: "person", n: p.works.length, lead: !!p.lead })),
  ];
  const links = [];
  for (const p of active) for (const w of p.works) links.push({ source: "p:" + p.slug, target: "w:" + w.slug });

  const cities = new Set(Object.values(venues).filter((v) => v.shows).map((v) => v.city || "Berlin"));
  const counts = {
    works: works.length,
    people: active.filter((p) => !p.author).length,
    shows: allShows.filter((s) => !s.upcoming).length,
    venues: Object.values(venues).filter((v) => v.shows).length,
    cities: cities.size,
  };

  for (const v of Object.values(venues)) {
    v.works = [...v.works].map((slug) => works.find((w) => w.slug === slug)).sort((a, b) => b.year - a.year);
    v.upcoming = program.filter((sh) => sh.venue === v.slug);
    v.courses = extras.courses.filter((c) => c.venue === v.slug);
  }
  const venuePages = Object.values(venues).filter((v) => v.address);
  // en aktif / en yeni mekândan en eskiye: son (ya da yaklaşan) gösterim veya kurs tarihine göre
  for (const v of Object.values(venues)) {
    const dates = allShows.filter((sh) => sh.venue === v.slug).map((sh) => sh.date)
      .concat(v.courses.map((c) => c.start));
    v.last = dates.sort().at(-1) || "";
  }
  const venueList = Object.values(venues).filter((v) => v.shows || v.courses.length)
    .sort((a, b) => b.last.localeCompare(a.last) || b.shows - a.shows);

  return {
    db, works, workBySlug: Object.fromEntries(works.map((w) => [w.slug, w])), people, venues, program, yearList, projects, courses: extras.courses,
    courseBySlug: Object.fromEntries(extras.courses.map((c) => [c.slug, c])),
    projectBySlug: Object.fromEntries(projects.map((p) => [p.slug, p])),
    programByMonth, soon, venuePages, venueList,
    network: { nodes, links }, counts, today,
    personList: Object.values(people).filter((p) => p.works.length || p.teaches.length || p.projects.length)
      .sort((a, b) => a.name.localeCompare(b.name, "tr")),
  };
}
