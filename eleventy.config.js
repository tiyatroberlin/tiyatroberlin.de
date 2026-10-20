import yaml from "js-yaml";

export default function (cfg) {
  cfg.addDataExtension("yaml", (c) => yaml.load(c));
  cfg.addPassthroughCopy({ "src/assets": "assets" });
  cfg.addPassthroughCopy({ "src/CNAME": "CNAME" });

  // metin: boş satırla ayrılmış paragraflar -> <p>
  cfg.addFilter("paras", (s) =>
    (s || "").trim().split(/\n\s*\n/).map((p) => `<p>${p.trim().replace(/\n/g, " ")}</p>`).join("\n"));
  cfg.addFilter("t", (o, lang) => (o && typeof o === "object" ? o[lang] ?? o.tr ?? "" : o ?? ""));
  cfg.addFilter("dmy", (iso) => { const [y, m, d] = iso.split("-"); return `${d}.${m}.${y}`; });
  cfg.addFilter("dm", (iso) => { const [, m, d] = iso.split("-"); return `${d}.${m}.`; });
  cfg.addFilter("yearOf", (iso) => iso.slice(0, 4));
  cfg.addFilter("weekday", (iso, i18n) => i18n.days[new Date(iso + "T12:00:00").getDay()]);
  cfg.addFilter("monthName", (iso, i18n) => i18n.months[+iso.slice(5, 7) - 1]);
  cfg.addFilter("roleName", (roles, key, lang) => roles[key][{ tr: 0, de: 1, en: 2 }[lang]]);
  cfg.addFilter("json", (v) => JSON.stringify(v));
  cfg.addFilter("initials", (n) => n.split(" ").map((w) => w[0]).slice(0, 2).join(""));

  return {
    dir: { input: "src", includes: "_includes", data: "_data", output: "_site" },
    templateFormats: ["njk"],
    htmlTemplateEngine: "njk",
    pathPrefix: process.env.PATH_PREFIX || "/",
  };
}
