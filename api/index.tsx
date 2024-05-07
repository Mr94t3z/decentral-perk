import {
  init,
  getFarcasterUserDetails,
  validateFramesMessage,
} from "@airstack/frames";
import { Frog, Button } from "frog";
import { devtools } from "frog/dev";
import { serveStatic } from "frog/serve-static";
import { handle } from 'frog/vercel';
import { Box, Heading, Text, VStack, vars } from "../lib/ui.js";
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

const ACTION_URL =
  "https://warpcast.com/~/add-cast-action?url=https://decentral-perk.vercel.app/api/decentral-perk";

const BG_IMAGE_URL = "https://remote-image.decentralized-content.com/image?url=https%3A%2F%2Fmagic.decentralized-content.com%2Fipfs%2Fbafkreibvmynk2n4k3edxxg6v65la4kequqipeqyox2aljnhmprdbk2bfwy&w=1920&q=75";

const CHANNEL_URL = "https://warpcast.com/~/channel/decentral-perk";

const baseUrlReservoir = process.env.RESERVOIR_API_URL;

const baseUrlNeynarV2 = process.env.BASE_URL_NEYNAR_V2;

const tokenAddress = process.env.DECENTRAL_PERK_REWARDS_CARD_NFT_TOKEN_ADDRESS;

init(process.env.AIRSTACK_API_KEY as string);

export const app = new Frog({
  assetsPath: "/",
  basePath: "/api",
  ui: { vars },
  browserLocation: ACTION_URL,
});

// Cast action GET handler
app.hono.get("/decentral-perk", async (c) => {
  return c.json({
    name: "Check $DP#5",
    icon: "search",
    description: "Action to check followers NFT Decentral Perk Rewards Card",
    aboutUrl: "https://github.com/Mr94t3z/decentral-perk",
    action: {
      type: "post",
    },
  });
});

// Cast action POST handler
app.hono.post("/decentral-perk", async (c) => {
  const body = await c.req.json();

  const { isValid, message } = await validateFramesMessage(body);
  const castFid = message?.data.frameActionBody.castId?.fid as number;
  if (isValid) {
    const { data, error } = await getFarcasterUserDetails({
      fid: castFid,
    });

    if (error) {
      return c.json({ message: "Error. Try Again." }, 500);
    }

    const username = data?.profileName || '';

    try {
        const responseUserData = await fetch(`${baseUrlNeynarV2}/user/bulk?fids=${castFid}`, {
          method: 'GET',
          headers: {
            'accept': 'application/json',
            'api_key': process.env.NEYNAR_API_KEY || '',
          },
        });

        const userFarcasterData = await responseUserData.json();
        const userData = userFarcasterData.users[0];

        // User connected wallet address
        const eth_addresses = userData.verified_addresses.eth_addresses.toString().toLowerCase().split(',')[0];

        // Get user tokens
        const responseUserToken = await fetch(`${baseUrlReservoir}/users/${eth_addresses}/tokens/v10?tokens=${tokenAddress}`, {
          headers: {
            'accept': 'application/json',
            'x-api-key': process.env.RESERVOIR_API_KEY || '',
          },
        });

        const userTokenData = await responseUserToken.json();
        let tokenCount = 0;

        if (userTokenData && userTokenData.tokens && userTokenData.tokens.length > 0) {
            tokenCount = userTokenData.tokens[0].ownership.tokenCount;
            console.log("Token Count:", tokenCount);
        } else {
            console.log("No tokens found.");
        }

        let message = '';
        if (tokenCount > 0) {
            message = `@${username} - ${tokenCount} $DC`;
            if (message.length > 30) {
                message = `${tokenCount} $DC`;
            }
        } else {
            message = `@${username} - 0 $DC`;
            if (message.length > 30) {
              message = `0 $DC`;
            }
        }

        return c.json({ message });
    } catch (fetchError) {
        console.error("Error fetching user token data:", fetchError);
        return c.json({ message: "Error fetching user token data. Try Again." }, 500);
    }
  } else {
    return c.json({ message: "Unauthorized" }, 401);
  }
});


// Frame handlers
app.frame("/", (c) => {
  return c.res({
    image: BG_IMAGE_URL,
    intents: [
      <Button action="/search">Search</Button>,
      <Button.Link href={ACTION_URL}>Add Action</Button.Link>,
      <Button.Link href={CHANNEL_URL}>DC Channel</Button.Link>,
    ],
  });
});


// app.frame("/search", (c) => {
//   return c.res({
//     image: (
//       <Box
//         grow
//         alignVertical="center"
//         backgroundImage={`url(${BG_IMAGE_URL})`}
//         padding="32"
//       >
//         <VStack gap="4">
//           <Heading color="fcPurple" align="center" size="48">
//             Castcred
//           </Heading>
//           <Text align="center" size="18">
//             +/- reputation weighted scale as an action bar.
//           </Text>
//           <Text decoration="underline" color="fcPurple" align="center"  size="14">
//             By @injustcuz and @0x94t3z
//           </Text>
//         </VStack>
//       </Box>
//     ),
//     intents: [
//       <Button action="/search">Search</Button>,
//       <Button.Link href={ACTION_URL}>Add Action</Button.Link>,
//       <Button.Link href={CHANNEL_URL}>DC Channel</Button.Link>,
//     ],
//   });
// });

// @ts-ignore
const isEdgeFunction = typeof EdgeFunction !== "undefined";
const isProduction = isEdgeFunction || (import.meta as any).env?.MODE !== "development";
devtools(app, isProduction ? { assetsPath: "/.frog" } : { serveStatic });

export const GET = handle(app);
export const POST = handle(app);