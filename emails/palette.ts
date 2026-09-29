// Email clients can't read CSS variables, so emails carry the light-theme
// primitives from styles/tokens.css as literal values. tests/emails.test.ts
// checks they still match. Brand guide: white background, wordmark header,
// posters, Inter body, one cobalt button, plain-text friendly.
export const palette = {
  white: "#FFFFFF",
  stone200: "#E6E5E3",
  stone100: "#F3F3F1",
  graphite: "#6B6B6B",
  ink: "#0A0A0A",
  cobalt: "#2B4BFF",
  cobalt600: "#1F3BE0",
  clay: "#9A4A36",
  ochre: "#7D5A12",
  moss: "#3F5E45",
  plum: "#5E4670",
} as const;

// Inter and Instrument Serif where the client has them, then system fonts.
export const fonts = {
  body: "Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif",
  display: "'Instrument Serif',Georgia,'Times New Roman',serif",
} as const;
