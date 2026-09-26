/** Curated Rovas project stubs for the invest screen (v1). Gifts path uses live Rovas nonprofit catalog. */

import type { CharityProject } from "@civic/shared";

export const CURATED_PROJECTS: CharityProject[] = [
  {
    id: "stub-invest-1",
    title: "Komunitná záhrada",
    organization: "Miestna iniciatíva",
    summary: "Investícia do spoločného priestoru so spoločenským výnosom.",
    rovas_url: "https://rovas.app/project/3",
    type: "invest",
    expected_yield_me_per_year: 12,
  },
  {
    id: "stub-invest-2",
    title: "Obnoviteľná energia pre obec",
    organization: "Energetické družstvo",
    summary: "Spoločný podiel na lokálnej energetike.",
    rovas_url: "https://rovas.app/project/4",
    type: "invest",
    expected_yield_me_per_year: 24,
  },
];
