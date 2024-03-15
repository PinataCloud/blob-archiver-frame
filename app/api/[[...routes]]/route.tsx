/** @jsxImportSource frog/jsx */

import { Button, Frog, TextInput } from "frog";
import { handle } from "frog/vercel";
import { PinataFDK } from 'pinata-fdk'

const fdk = new PinataFDK({
pinata_jwt: process.env.PINATA_JWT || '',
pinata_gateway: ''
})

const app = new Frog({
  basePath: "/api",
  // Supply a Hub API URL to enable frame verification.
  // hubApiUrl: 'https://api.hub.wevm.dev',
});

app.use('/', fdk.analyticsMiddleware({ frameId: 'blob-uploader'}))

const uploadFile = async (url: any) => {
  try {
    const hash = new URL(url).pathname.split("/").pop();

    let data = new FormData();

    if (hash?.startsWith("0x0")) {
      const hash = new URL(url).pathname.split("/").pop();
      const urlStream = await fetch(`https://api.blobscan.com/blobs/${hash}`);
      const arrayBuffer = await urlStream.arrayBuffer();
      const blob = new Blob([arrayBuffer], { type: "application/json" });
      data.append("file", blob);
    } else {
      const tx = await fetch(`https://api.blobscan.com/transactions/${hash}`);
      const txData = await tx.json();

      let blobs: any = [];
      let folder = "blobs";
      await Promise.all(
        txData.blobs.map(async (blob: any) => {
          const blobStream = await fetch(
            `https://api.blobscan.com/blobs/${blob}`,
          );
          const arrayBuffer = await blobStream.arrayBuffer();
          const blobFile = new Blob([arrayBuffer], {
            type: "application/json",
          });
          blobs.push(blobFile);
        }),
      );
      Array.from(blobs).forEach((blob: any, index: number) => {
        data.append("file", blob, `${folder}/blob_${index}`);
      });
    }
    const response = await fetch(
      "https://api.pinata.cloud/pinning/pinFileToIPFS",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.PINATA_JWT}`,
        },
        body: data,
      },
    );

    const { IpfsHash } = await response.json();
    const link = `https://dweb.mypinata.cloud/ipfs/${IpfsHash}`;
    console.log(link);
    return link;
  } catch (error) {
    console.log(error);
    return error;
  }
};

// Uncomment to use Edge Runtime
// export const runtime = 'edge'

app.frame("/", (c) => {
  return c.res({
    action: "/upload",
    image:
      "https://dweb.mypinata.cloud/ipfs/QmRbXqzam6CjmUzNhfHZ3GpwBgynX6WLmVr1pqsRKJQY5d",
    imageAspectRatio: '1:1',
    intents: [
      <TextInput placeholder="Blobscan Link" />,
      <Button>Upload</Button>,
    ],
  });
});

app.frame("/upload", async (c) => {
  const url = c.inputText;

  const link = await uploadFile(url)

  return c.res({
    action: "/upload",
    image:
      "https://dweb.mypinata.cloud/ipfs/QmaFoWqZrbgFiVZZ6uSzDJY7yi7Mjbr9Us2F4AygZHpYx8",
        imageAspectRatio: '1:1',
    intents: [
      <Button action='/'>Go Back</Button>,
      <Button.Link href={`${link}`}>View on IPFS</Button.Link>,
      <Button.Link href='https://www.pinata.cloud/ipfs'>Learn More</Button.Link>
    ],
  });
});

export const GET = handle(app);
export const POST = handle(app);
