exports.handler = async function(event, context) {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type"
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  
  // Debug: tell us exactly what's happening
  if (!apiKey) {
    return { 
      statusCode: 500, 
      headers, 
      body: JSON.stringify({ 
        error: "Key missing",
        env_keys_present: Object.keys(process.env).filter(k => k.includes("ANTHROPIC")).join(", ") || "none found",
        all_keys_count: Object.keys(process.env).length
      }) 
    };
  }

  return { 
    statusCode: 200, 
    headers, 
    body: JSON.stringify({ 
      content: [{ text: "DEBUG: Key found, length " + apiKey.length }]
    }) 
  };
};
