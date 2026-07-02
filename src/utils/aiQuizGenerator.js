export const generateQuizFromWords = async (translatedItems) => {
  if (!translatedItems || translatedItems.length === 0) return null;

  try {
    const res = await fetch("/api/generate-quiz", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ translatedItems })
    });

    if (!res.ok) {
      const err = await res.json().catch(()=>({}));
      console.error("Quiz API Error:", err);
      return { error: err.error || `Süni İntellekt serverində xəta baş verdi (${res.status})` };
    }

    const data = await res.json();
    if (data.error) {
      return { error: data.error };
    }

    return data;

  } catch (error) {
    console.error("Error generating AI quiz:", error);
    return { error: error.message || "Tərcümə edilərkən xəta baş verdi" };
  }
};
