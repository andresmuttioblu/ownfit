import { Briefcase, Coffee, Dumbbell, Mountain, Plane, Shirt, Star, Wine, type LucideIcon } from "lucide-react";

// Activities are free text, so match on words; anything unknown gets a plain shirt.
const ICONS: [RegExp, LucideIcon][] = [
  [/office|work|meeting|interview/, Briefcase],
  [/gym|run|sport|yoga|train/, Dumbbell],
  [/outdoor|hike|walk|park|camp/, Mountain],
  [/night|date|dinner|party|bar/, Wine],
  [/formal|wedding|gala|event/, Star],
  [/travel|trip|flight|airport/, Plane],
  [/casual|coffee|weekend|brunch|errand/, Coffee],
];

export const activityIcon = (activity: string): LucideIcon => ICONS.find(([re]) => re.test(activity.toLowerCase()))?.[1] ?? Shirt;
