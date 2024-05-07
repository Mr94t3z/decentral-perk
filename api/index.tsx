import {
  init,
  getFarcasterUserDetails,
  validateFramesMessage,
} from "@airstack/frames";
import { Frog, Button, TextInput } from "frog";
import { devtools } from "frog/dev";
import { serveStatic } from "frog/serve-static";
import { handle } from 'frog/vercel';
import { Box, Image, Heading, Text, VStack, Spacer, vars } from "../lib/ui.js";
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

const ACTION_URL =
  "https://warpcast.com/~/add-cast-action?url=https://decentral-perk.vercel.app/api/decentral-perk";

const CHANNEL_URL = "https://warpcast.com/~/channel/decentral-perk";

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

  const baseUrlNeynarV2 = process.env.BASE_URL_NEYNAR_V2;
  const baseUrlReservoir = process.env.BASE_URL_RESEVOIR;

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
  
      // User connected wallet addresses
      const ethAddresses = userData.verified_addresses.eth_addresses.map((address: string) => address.toLowerCase());
  
      // Array to store token counts for each address
      const tokenCounts = [];
  
      for (const ethAddress of ethAddresses) {
          try {
              // Get user tokens for the current Ethereum address
              const responseUserToken = await fetch(`${baseUrlReservoir}/users/${ethAddress}/tokens/v10?tokens=${tokenAddress}`, {
                  headers: {
                      'accept': 'application/json',
                      'x-api-key': process.env.RESERVOIR_API_KEY || '',
                  },
              });
  
              const userTokenData = await responseUserToken.json();
  
              if (userTokenData && userTokenData.tokens && userTokenData.tokens.length > 0) {
                  const tokenCount = userTokenData.tokens[0].ownership.tokenCount;
                  tokenCounts.push(tokenCount);
                  console.log(`Token Count for ${ethAddress}:`, tokenCount);
              } else {
                  console.log(`No tokens found for ${ethAddress}.`);
                  tokenCounts.push(0);
              }
          } catch (error) {
              console.error(`Error fetching tokens for ${ethAddress}:`, error);
              tokenCounts.push(0);
          }
      }
  
      // Calculate total token count
      const totalTokenCount = tokenCounts.reduce((acc, count) => acc + parseInt(count), 0);
  
      let message = '';
      if (totalTokenCount > 0) {
          message = `@${username} - ${totalTokenCount} $DP#5`;
          if (message.length > 30) {
              message = `${totalTokenCount} $DP#5`;
          }
      } else {
          message = `@${username} - 0 $DP#5`;
          if (message.length > 30) {
              message = `0 $DP#5`;
          }
      }
  
      return c.json({ message });
    } catch (fetchError) {
        console.error("Error fetching user data:", fetchError);
        return c.json({ message: "Error fetching user data. Try Again." }, 500);
    }
  } else {
    return c.json({ message: "Unauthorized" }, 401);
  }
});


// Frame handlers
app.frame("/", (c) => {
  return c.res({
    image: (
      <Box
        grow
        alignVertical="center"
        // backgroundImage={`url(${BG_IMAGE_URL})`}
        backgroundColor="bg"
        padding="32"
        height="100%"
        border="1em solid rgb(255,255,255)"
      >
        <Image 
          src="/nft.png"
          objectFit="contain"
        />
      </Box>
    ),
    intents: [
      <Button action="/search">Search</Button>,
      <Button.Link href={ACTION_URL}>Add Action</Button.Link>,
      <Button.Link href="https://warpcast.com/~/compose?text=DP%20Rewards%20Card%20NFT%20Checker&embeds[]=https://decentral-perk.vercel.app/api">Share</Button.Link>,
      <Button.Link href={CHANNEL_URL}>Channel</Button.Link>,
    ],
  });
});


app.frame("/search", (c) => {
  return c.res({
    image: (
      <Box
        grow
        alignVertical="center"
        // backgroundImage={`url(${BG_IMAGE_URL})`}
        backgroundColor="black"
        padding="32"
        height="100%"
      >
        <VStack gap="4">
          <Heading color="fcPurple" decoration="underline" weight="900" align="center" size="32">
            DP Rewards Card NFT Checker
          </Heading>
          <Spacer size="10" />
          <Text align="center" color="green" size="16">
            This action will check the number of $DP#5 tokens you have in your wallet.
          </Text>
          <Spacer size="22" />
            <Box flexDirection="row" justifyContent="center">
                <Text color="white" align="center" size="14">created by</Text>
                <Spacer size="10" />
                <Text color="bg" decoration="underline" align="center" size="14"> @0x94t3z</Text>
              </Box>
        </VStack>
      </Box>
    ),
    intents: [
      <TextInput placeholder="Enter username e.g. 0x94t3z" />,
      <Button action="/search">⇧ Submit</Button>,
      <Button action="/">⏏︎ Cancel</Button>,
    ],
  });
});

// @ts-ignore
const isEdgeFunction = typeof EdgeFunction !== "undefined";
const isProduction = isEdgeFunction || (import.meta as any).env?.MODE !== "development";
devtools(app, isProduction ? { assetsPath: "/.frog" } : { serveStatic });

export const GET = handle(app);
export const POST = handle(app);