/**
 * Human labels for enum values — South African English. Kept separate from the
 * enums so copy can change without touching the value sets. Reused by the
 * dossier, reporting, and funder surfaces.
 */
import type {
  AgeBand,
  EmploymentStatus,
  Gender,
  PopulationGroup,
} from "@/lib/domain/enums";

export const GENDER_LABELS: Record<Gender, string> = {
  female: "Female",
  male: "Male",
  non_binary: "Non-binary",
  other: "Other",
  undisclosed: "Undisclosed",
};

export const POPULATION_GROUP_LABELS: Record<PopulationGroup, string> = {
  black_african: "Black African",
  coloured: "Coloured",
  indian_asian: "Indian / Asian",
  white: "White",
  other: "Other",
  undisclosed: "Undisclosed",
};

export const EMPLOYMENT_LABELS: Record<EmploymentStatus, string> = {
  employed: "Employed",
  self_employed: "Self-employed",
  unemployed: "Unemployed",
  student: "Student",
  retired: "Retired",
  undisclosed: "Undisclosed",
};

export const AGE_BAND_LABELS: Record<AgeBand, string> = {
  under_18: "Under 18",
  "18_24": "18–24",
  "25_34": "25–34",
  "35_44": "35–44",
  "45_54": "45–54",
  "55_64": "55–64",
  "65_plus": "65+",
};
