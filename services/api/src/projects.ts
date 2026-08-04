/** Curated Rovas project stubs for charity / invest screens (v1). */

import type { CharityProject } from "@civic/shared";

export const CURATED_PROJECTS: CharityProject[] = [
  {
    id: "stub-charity-1",
    title: "Pomoc ľuďom bez domova",
    organization: "Príkladová organizácia",
    summary: "Podpora denného centra a materiálnej pomoci.",
    rovas_url: "https://rovas.app/project/1",
    type: "charity",
  },
  {
    id: "stub-charity-2",
    title: "Vzdelávanie detí z ohrozených rodín",
    organization: "Príkladová organizácia",
    summary: "Doučovanie a mimoškolské aktivity.",
    rovas_url: "https://rovas.app/project/2",
    type: "charity",
  },
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
