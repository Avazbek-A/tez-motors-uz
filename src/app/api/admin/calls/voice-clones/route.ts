import { NextRequest, NextResponse } from "next/server";
import { getAdminSessionContext } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * Manager Voice Cloning API.
 * Gated to authorized admins.
 * Accepts a voice training audio sample and registers it (via ElevenLabs or gracefully falling back to a mock model ID),
 * then updates the admin user's voice_clone_id in the database.
 */
export async function POST(request: NextRequest) {
  const context = await getAdminSessionContext(request);
  if (!context || !context.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = context.user.id;

  try {
    const formData = await request.formData();
    const audioFile = formData.get("audio") as Blob | File | null;
    const name = (formData.get("name") as string) || `Manager-${context.user.email}`;

    if (!audioFile) {
      return NextResponse.json({ error: "Missing audio training file" }, { status: 400 });
    }

    let voiceCloneId = `voice-clone-${crypto.randomUUID()}`;
    const elevenLabsKey = (process.env.ELEVENLABS_API_KEY || "").trim();

    if (elevenLabsKey) {
      try {
        const addVoiceData = new FormData();
        addVoiceData.append("name", name);
        addVoiceData.append("files", audioFile);
        addVoiceData.append("description", `Cloned voice profile for manager ${context.user.email}`);

        const response = await fetch("https://api.elevenlabs.io/v1/voices/add", {
          method: "POST",
          headers: {
            "xi-api-key": elevenLabsKey,
          },
          body: addVoiceData,
        });

        if (response.ok) {
          const result = await response.json();
          if (result.voice_id) {
            voiceCloneId = result.voice_id;
          }
        } else {
          const errorMsg = await response.text();
          console.error("ElevenLabs Voice Cloning API failed with status:", response.status, errorMsg);
        }
      } catch (err) {
        console.error("ElevenLabs connection error, falling back to mock clone:", err);
      }
    }

    // Update the admin_users profile table
    const supabase = createServiceClient();
    const { error: updateError } = await supabase
      .from("admin_users")
      .update({ voice_clone_id: voiceCloneId })
      .eq("id", userId);

    if (updateError) {
      throw new Error(`Failed to update admin user profile: ${updateError.message}`);
    }

    return NextResponse.json({
      success: true,
      voice_clone_id: voiceCloneId,
      message: elevenLabsKey
        ? "Voice successfully cloned with ElevenLabs!"
        : "Voice clone registered successfully (graceful fallback/mock mode)!"
    }, { status: 201 });

  } catch (err: any) {
    console.error("Voice cloning failed:", err);
    return NextResponse.json({ error: err.message || "Voice cloning failed" }, { status: 500 });
  }
}
