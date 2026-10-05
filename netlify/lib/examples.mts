import { KINDS, NEEDS, SHARE, SPACE_SIZES, TIMINGS } from "./profiles.mts";

// Invented businesses for reviewing the members area on previews. Always labelled as examples.
interface ExampleSeed {
  id: string;
  personName: string;
  businessName: string;
  trade: string;
  kind: keyof typeof KINDS;
  area: string;
  headline: string;
  about: string;
  spaceSize: keyof typeof SPACE_SIZES;
  timing: keyof typeof TIMINGS;
  shareWith: keyof typeof SHARE;
  needs: (keyof typeof NEEDS)[];
  neighbours: string;
  photo: string;
}

const SEEDS: ExampleSeed[] = [
  {
    id: "example-halden",
    personName: "Mia",
    businessName: "Halden Studio",
    trade: "Brand and web design",
    kind: "desk",
    area: "Hamilton",
    headline: "Two designers after a quiet corner with good light and better coffee.",
    about:
      "We're a two-person studio making brands and websites for small businesses around the Hunter. We've spent three years at the kitchen table and we're ready for a door we can close.\n\nWe'd love a bright section with room for a big table, somewhere to meet clients, and neighbours we can bounce ideas off over lunch.",
    spaceSize: "room",
    timing: "soon",
    shareWith: "3",
    needs: ["quiet", "clients"],
    neighbours: "A copywriter, a photographer or anyone who loves a good brief.",
    photo: "/assets/photos/desk.jpg",
  },
  {
    id: "example-tarrant",
    personName: "Luke",
    businessName: "Tarrant & Co. Barbers",
    trade: "Barber",
    kind: "services",
    area: "Merewether",
    headline: "A two-chair barber after a street-facing section and good neighbours.",
    about:
      "Twelve years cutting hair, the last four from a rented chair. I want a small shop of my own without signing a five-year lease on a whole building.\n\nTwo chairs, a basin, a bit of storage, and a front window people walk past. Walk-ins welcome, bookings preferred.",
    spaceSize: "room",
    timing: "now",
    shareWith: "2",
    needs: ["clients", "water"],
    neighbours: "A tattoo studio, a coffee cart, anyone whose clients like a fresh cut.",
    photo: "/assets/photos/barber.jpg",
  },
  {
    id: "example-kestrel",
    personName: "Priya",
    businessName: "Kestrel Strength",
    trade: "Personal training studio",
    kind: "services",
    area: "Adamstown",
    headline: "Small-group strength sessions. Needs floor, a roller door and neighbours who don't mind a playlist.",
    about:
      "I run small-group strength classes, six people at a time, mostly early mornings and evenings. I need clear floor space, good ventilation and somewhere to store racks and plates.\n\nQuiet through the middle of the day, which suits neighbours who work the other way round.",
    spaceSize: "studio",
    timing: "soon",
    shareWith: "open",
    needs: ["roller", "power", "storage"],
    neighbours: "A physio, a nutritionist or a massage therapist would be perfect.",
    photo: "/assets/photos/fitness.jpg",
  },
  {
    id: "example-quill",
    personName: "Tom",
    businessName: "Quill Bookkeeping",
    trade: "Bookkeeping practice",
    kind: "desk",
    area: "Charlestown",
    headline: "Three bookkeepers who miss having people around. Happy to share a meeting room.",
    about:
      "We look after the books for about sixty small businesses. The work is quiet and the clients are lovely, but three of us working from home has gone on long enough.\n\nWe need three desks, a meeting table for client catch-ups and parking nearby.",
    spaceSize: "room",
    timing: "later",
    shareWith: "3",
    needs: ["quiet", "clients", "parking"],
    neighbours: "Other desk-based businesses. A designer or a developer would be great company.",
    photo: "/assets/photos/collaborate.jpg",
  },
];

function lookingFor(seed: ExampleSeed) {
  return [
    { label: "Space", value: SPACE_SIZES[seed.spaceSize] },
    { label: "Sharing with", value: SHARE[seed.shareWith] },
    { label: "Timing", value: TIMINGS[seed.timing] },
  ];
}

function toFull(seed: ExampleSeed) {
  return {
    id: seed.id,
    example: true,
    personName: seed.personName,
    businessName: seed.businessName,
    trade: seed.trade,
    kind: seed.kind,
    kindLabel: KINDS[seed.kind],
    area: seed.area,
    headline: seed.headline,
    lookingFor: lookingFor(seed),
    needs: seed.needs.map((n) => NEEDS[n]),
    hero: seed.photo,
    about: seed.about,
    neighbours: seed.neighbours,
    website: "",
    instagram: "",
    gallery: [] as string[],
    memberSince: "",
  };
}

export function exampleSummaries() {
  return SEEDS.map(toFull);
}

export function exampleProfile(id: string) {
  const seed = SEEDS.find((s) => s.id === id);
  return seed ? toFull(seed) : null;
}
