import { createSystem } from "frog/ui";

export const { Box, Image, Heading, Text, VStack, Spacer, vars } = createSystem({
  colors: {
    white: "white",
    black: "black",
    red: "red",
    green: "rgb(88,156,84)",
    fcPurple: "rgb(71,42,145)",
    bg: "rgb(116,80,73)"
  },
  fonts: {
    default: [
      {
        name: "Madimi One",
        source: "google",
      },
    ],
  },
});