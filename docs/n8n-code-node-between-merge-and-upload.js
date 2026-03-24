// Code à coller dans le node "Code" (entre Merge et Upload CV to MinIO)
// Mode: "Run Once for All Items"
// n8n n'expose pas toujours "items" → on utilise $input.all()

const items = $input.all();
const baseUrl = 'http://localhost:9000';

return items.map((item) => {
  const uploadUrl = String(item.json.uploadUrl || '').trim();
  let fullUploadUrl = baseUrl + uploadUrl;
  fullUploadUrl = fullUploadUrl.replace(/^[=]+/, '').replace(/^-+/, '');
  if (!fullUploadUrl.startsWith('http')) fullUploadUrl = baseUrl + uploadUrl;

  return {
    json: { ...item.json, fullUploadUrl },
    binary: item.binary,
  };
});
