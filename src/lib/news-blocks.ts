export type ArticleBlock =
  | { type: "p"; text: string }
  | { type: "h2"; text: string }
  | { type: "list"; items: string[] }
  | {
      type: "table";
      caption?: string;
      headers: string[];
      rows: string[][];
    }
  | {
      type: "scores";
      title: string;
      groups: { label: string; lines: string[] }[];
    }
  | {
      type: "rounds";
      items: { kicker: string; title: string; detail: string }[];
    }
  | {
      type: "glance";
      items: { year: string; team: string; result: string; note: string }[];
    }
  | { type: "note"; text: string }
  | {
      type: "image";
      src: string;
      alt: string;
      caption?: string;
      width: number;
      height: number;
      size?: "card";
      expand?: boolean;
    }
  | {
      type: "gallery";
      expand?: boolean;
      photos: {
        src: string;
        alt: string;
        caption?: string;
        width: number;
        height: number;
      }[];
    }
  | {
      type: "people";
      items: {
        title: string;
        paragraphs: string[];
        note?: string;
        image?: {
          src: string;
          alt: string;
          width: number;
          height: number;
        };
      }[];
    };
