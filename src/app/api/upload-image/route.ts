import { NextRequest, NextResponse } from "next/server";

// Pure Web-API base64 encoder (no Buffer) - runs unmodified on Node.js
// (Vercel), Vercel/Node Edge, and Cloudflare Workers/Pages.
function uint8ToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

// Free image hosting services that don't require API keys
const IMAGE_HOSTS = [
  {
    name: "imgbb",
    upload: async (base64Data: string) => {
      // imgbb free tier - no API key required for basic uploads
      const formData = new FormData();
      formData.append("image", base64Data);
      
      const res = await fetch("https://api.imgbb.com/1/upload?key=d36eb6591370ae7f9089d85875571556", {
        method: "POST",
        body: formData,
      });
      
      if (!res.ok) return null;
      const data = await res.json();
      return data.data?.url || data.data?.display_url;
    },
  },
  {
    name: "freeimage",
    upload: async (base64Data: string) => {
      const formData = new FormData();
      formData.append("source", base64Data);
      formData.append("type", "base64");
      formData.append("action", "upload");
      
      const res = await fetch("https://freeimage.host/api/1/upload?key=6d207e02198a847aa98d0a2a901485a5", {
        method: "POST",
        body: formData,
      });
      
      if (!res.ok) return null;
      const data = await res.json();
      return data.image?.url;
    },
  },
];

// Upload image from URL to free hosting
async function uploadFromUrl(imageUrl: string): Promise<string | null> {
  try {
    // Fetch the image
    const imgRes = await fetch(imageUrl);
    if (!imgRes.ok) return null;
    
    const arrayBuffer = await imgRes.arrayBuffer();
    const base64 = uint8ToBase64(new Uint8Array(arrayBuffer));

    // Try each host
    for (const host of IMAGE_HOSTS) {
      try {
        const url = await host.upload(base64);
        if (url) {
          console.log(`Image uploaded to ${host.name}: ${url}`);
          return url;
        }
      } catch (e) {
        console.log(`${host.name} failed:`, e);
        continue;
      }
    }
    
    return null;
  } catch {
    return null;
  }
}

// Upload base64 image to free hosting
async function uploadBase64(base64Data: string): Promise<string | null> {
  // Remove data URL prefix if present
  const cleanBase64 = base64Data.replace(/^data:image\/\w+;base64,/, "");
  
  for (const host of IMAGE_HOSTS) {
    try {
      const url = await host.upload(cleanBase64);
      if (url) {
        console.log(`Image uploaded to ${host.name}: ${url}`);
        return url;
      }
    } catch (e) {
      console.log(`${host.name} failed:`, e);
      continue;
    }
  }
  
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { imageUrl, base64 } = body;
    
    let uploadedUrl: string | null = null;
    
    if (base64) {
      uploadedUrl = await uploadBase64(base64);
    } else if (imageUrl) {
      // If it's already a permanent hosting URL, just return it
      if (
        imageUrl.includes("imgbb.com") ||
        imageUrl.includes("imgur.com") ||
        imageUrl.includes("i.ibb.co") ||
        imageUrl.includes("cloudinary.com")
      ) {
        uploadedUrl = imageUrl;
      } else {
        // Re-upload to permanent hosting
        uploadedUrl = await uploadFromUrl(imageUrl);
      }
    }
    
    if (!uploadedUrl) {
      return NextResponse.json(
        { error: "Failed to upload image to any host" },
        { status: 500 }
      );
    }
    
    return NextResponse.json({ success: true, url: uploadedUrl });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : "Upload failed";
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
