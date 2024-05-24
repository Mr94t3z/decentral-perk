import {
  init,
  // getFarcasterUserDetails,
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

const CAST_INTENS = 
  "https://warpcast.com/~/compose?text=DP%20Rewards%20Checker&embeds[]=https://decentral-perk.vercel.app/api"

const CHANNEL_URL = 
  "https://warpcast.com/~/channel/decentral-perk";

init(process.env.AIRSTACK_API_KEY as string);

export const app = new Frog({
  assetsPath: "/",
  basePath: "/api",
  ui: { vars },
  browserLocation: ACTION_URL,
});

// Support Open Frames
app.use(async (c, next) => {

  await next();
  const isFrame = c.res.headers.get('content-type')?.includes('html');
  if (isFrame) {
    let html = await c.res.text();
    const regex = /<meta.*?\/>/gs;
    const matches = [...html.matchAll(regex)];
    let metaTags = matches.map((match) => match[0])?.join?.('');
    /*
    of:image    fc:frame:image
    og:image    og:image
    of:button:$idx    fc:frame:button:index
    of:button:$idx:action    fc:frame:button:$idx:action
    of:button:$idx:target    fc:frame:button:$idx:target
    of:input:text    fc:frame:input:text
    of:image:aspect_ratio    fc:frame:image:aspect_ratio
    of:accepts:farcaster    fc:frame
    of:state    fc:frame:state
    */
    // Complete replacements according to the mapping provided
    let openFrameTags = metaTags
      .replaceAll('fc:frame:image', 'of:image')
      // Assuming a pattern for of:button:$idx replacements
      .replace(/fc:frame:button:(\d+)/g, 'of:button:$1')
      .replace(/fc:frame:button:(\d+):action/g, 'of:button:$1:action')
      .replace(/fc:frame:button:(\d+):target/g, 'of:button:$1:target')
      // Additional replacements based on the provided pattern
      .replaceAll('fc:frame:input:text', 'of:input:text')
      .replaceAll('fc:frame:image:aspect_ratio', 'of:image:aspect_ratio')
      .replaceAll('fc:frame:state', 'of:state');

    openFrameTags += [
      `<meta property="of:accepts:farcaster" content="vNext"/>`,
      `<meta property="of:accepts:xmtp" content="2024-02-01"/>`,
      `<meta property="of:accepts:lens" content="1.1"/>`,
    ].join('\n');

    html = html.replace(/(<head>)/i, `$1${openFrameTags}`);

    c.res = new Response(html, {
      headers: {
        'content-type': 'text/html',
      },
    });
  }
});

// Cast action GET handler
app.hono.get("/decentral-perk", async (c) => {
  return c.json({
    name: "DP Rewards Checker ☕️",
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
  const tokenAddress = process.env.DECENTRAL_PERK_REWARDS_CARD_NFT_TOKEN_ADDRESS;

  const { isValid, message } = await validateFramesMessage(body);
  const castFid = message?.data.frameActionBody.castId?.fid as number;
  if (isValid) {
    // const { data, error } = await getFarcasterUserDetails({
    //   fid: castFid,
    // });

    // const username = data?.profileName;

    // if (error) {
    //   return c.json({ message: "Error. Try Again." }, 500);
    // }
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

      const username = userData.username;
  
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
          message = `@${username} - ${totalTokenCount} DP #5`;
          if (message.length > 30) {
              message = `${totalTokenCount} DP #5`;
          }
      } else {
          message = `@${username} - 0 DP #5`;
          if (message.length > 30) {
              message = `0 DP #5`;
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
        backgroundColor="bg"
        padding="32"
        height="100%"
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
      <Button.Link href={CAST_INTENS}>Share</Button.Link>,
      <Button.Link href={CHANNEL_URL}>Channel</Button.Link>,
    ],
  });
});

// Frame handler for search action
app.frame("/search", (c) => {
  return c.res({
    action: '/result',
    image: (
      <Box
        grow
        alignVertical="center"
        backgroundColor="white"
        padding="48"
        textAlign="center"
        height="100%"
      >
        <VStack gap="4">
          <Heading color="fcPurple" decoration="underline" weight="900" align="center" size="32">
            DP Rewards Checker
          </Heading>
          <Spacer size="16" />
          <Text align="center" color="green" size="18">
            This action will check the number of $DP#5 tokens you have in your wallet.
          </Text>
          <Spacer size="22" />
            <Box flexDirection="row" justifyContent="center">
                <Text color="black" align="center" size="14">created by</Text>
                <Spacer size="10" />
                <Text color="fcPurple" decoration="underline" align="center" size="14"> @0x94t3z</Text>
              </Box>
        </VStack>
      </Box>
    ),
    intents: [
      <TextInput placeholder="Enter username e.g. boothang" />,
      <Button action="/result">⇧ Submit</Button>,
      <Button action="/">⏏︎ Cancel</Button>,
    ],
  });
});

// Frame handler for result
app.frame("/result", async (c) => {
  try {
    const { inputText } = c;

    const username = inputText;

    console.log('Username:', username);

    const baseUrlNeynarV2 = process.env.BASE_URL_NEYNAR_V2;
    const baseUrlReservoir = process.env.BASE_URL_RESEVOIR;
    const tokenAddress = process.env.DECENTRAL_PERK_REWARDS_CARD_NFT_TOKEN_ADDRESS;

    const responseUserData = await fetch(`${baseUrlNeynarV2}/user/search?q=${username}`, {
        method: 'GET',
        headers: {
            'accept': 'application/json',
            'api_key': process.env.NEYNAR_API_KEY || '',
        },
    });

    const userDataResponse = await responseUserData.json();

    if (userDataResponse.result && userDataResponse.result.users && userDataResponse.result.users.length > 0) {
        const userData = userDataResponse.result.users[0];
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

        return c.res({
            image: (
                <Box
                    grow
                    alignVertical="center"
                    backgroundColor="white"
                    padding="48"
                    textAlign="center"
                    height="100%"
                >
                    <VStack gap="4">
                        <Heading color="fcPurple" decoration="underline" weight="900" align="center" size="32">
                            Result
                        </Heading>
                        <Spacer size="10" />
                        <Text align="center" color="green" size="16">
                          @{username}, you have {totalTokenCount ? `(${totalTokenCount}) $DP#5` : "(0) $DP#5"} tokens in your wallet.
                        </Text>
                        <Spacer size="22" />
                        <Box flexDirection="row" justifyContent="center">
                            <Text color="black" align="center" size="14">created by</Text>
                            <Spacer size="10" />
                            <Text color="fcPurple" decoration="underline" align="center" size="14"> @0x94t3z</Text>
                        </Box>
                    </VStack>
                </Box>
            ),
            intents: [
                <Button action="/">⎋ Home</Button>,
                <Button action="/search">⏏︎ Back</Button>
            ],
        });
    } else {
        return c.res({
            image: (
                <Box
                    grow
                    alignVertical="center"
                    backgroundColor="white"
                    padding="48"
                    textAlign="center"
                    height="100%"
                >
                    <VStack gap="4">
                        <Heading color="fcPurple" decoration="underline" weight="900" align="center" size="32">
                            Error
                        </Heading>
                        <Spacer size="16" />
                        <Text align="center" color="red" size="16">
                            User data not found.
                        </Text>
                        <Spacer size="22" />
                        <Box flexDirection="row" justifyContent="center">
                            <Text color="black" align="center" size="14">created by</Text>
                            <Spacer size="10" />
                            <Text color="fcPurple" decoration="underline" align="center" size="14"> @0x94t3z</Text>
                        </Box>
                    </VStack>
                </Box>
            ),
            intents: [
                <Button action="/search">⏏︎ Try Again</Button>
            ],
        });
    }
} catch (error) {
      console.error("Error fetching user data:", error);
      return c.res({
        image: (
          <Box
              grow
              alignVertical="center"
              backgroundColor="white"
              padding="48"
              textAlign="center"
              height="100%"
          >
              <VStack gap="4">
                  <Heading color="fcPurple" decoration="underline" weight="900" align="center" size="32">
                      Error
                  </Heading>
                  <Spacer size="16" />
                  <Text align="center" color="red" size="16">
                      Uh oh, something went wrong. Try again.
                  </Text>
                  <Spacer size="22" />
                  <Box flexDirection="row" justifyContent="center">
                      <Text color="black" align="center" size="14">created by</Text>
                      <Spacer size="10" />
                      <Text color="fcPurple" decoration="underline" align="center" size="14"> @0x94t3z</Text>
                  </Box>
              </VStack>
          </Box>
      ),
      intents: [
          <Button action="/search">⏏︎ Try Again</Button>
      ],
    });
  }
});


// @ts-ignore
const isEdgeFunction = typeof EdgeFunction !== "undefined";
const isProduction = isEdgeFunction || (import.meta as any).env?.MODE !== "development";
devtools(app, isProduction ? { assetsPath: "/.frog" } : { serveStatic });

export const GET = handle(app);
export const POST = handle(app);