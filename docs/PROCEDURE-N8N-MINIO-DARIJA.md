# Procédure n8n + MinIO — شرح بالدارجة

## 1. شنو تْعاود فْالْپروسيدير (الخطوات فْ n8n)

### قبل ما تْشغّل الـ workflow

1. **شغّل الـ API (backend)**  
   فْ الطرفية:
   ```bash
   cd "c:\Users\DELL\Desktop\Automated CV Analysis from Gmail to HR Email"
   node server/index.js
   ```
   خصّك تشوف: `PCA API (Express) running at http://localhost:3005`

2. **شغّل MinIO** (باقي نشْرحوه تحت)  
   باختصار: MinIO خدّام على الـ port 9000، الـ workflow كيْبعث الـ CV على `http://localhost:9000/cv/xxx`.  
   إلا ما شغّلتيش MinIO، الـ node « 3 - Upload CV to MinIO » يمكن يفشل (والـ workflow كيْكمّل بفضل « continue on error »).

3. **فْ n8n**
   - دير **Import** للـ workflow من الملف `n8n-workflow-fixed.json`.
   - سِلّم الـ **Gmail credential** (الحساب لي كيْجيب الإيميلات).
   - اختيارياً: دير **Fetch Test Event** على الـ **Gmail Trigger** باخ تصير عندك 1 item (إيميل + CV) للاختبار.

### شنو كيْقع فْ الـ workflow (الْپروسيدير)

| الخطوة | الـ node | شنو كيْدير |
|--------|---------|------------|
| 0 | **Gmail Trigger** | كيْستنا إيميل جديد، كيْخرج الإيميل + الـ attachment (الـ CV) باسم `attachment_0`. |
| 1 | **1 - Initialize Candidate API** | كيْبعث POST على `http://localhost:3005/api/test/candidatures`، الـ API كيْرجع `candidateId` و `uploadUrl` (مثلاً `http://localhost:9000/cv/mock-xxx`). |
| 2 | **2 - Merge** | كيْجمع الـ item من Gmail (فيه الـ CV = `attachment_0`) مع الـ item من الـ API (فيه `uploadUrl`)، وْ كيْخرج item واحد فيه الـ deux. |
| 3 | **3 - Upload CV to MinIO** | كيْبعث الـ CV (binary) بـ PUT على الـ `uploadUrl`. هادا هو الـ upload فعلاً. |
| 4 | **Edit Fields** | كيْزيد `status: uploaded` و `candidateId` للـ result. |

فين تتأكد بلي الـ CV تْuploada؟  
→ فْ MinIO: Console على الـ port 9001، تدخل للـ bucket `cv` وْ تشوف الـ object (الملف) بالـ ID ديال الـ candidate (مثلاً `mock-1772040593473-pirlfm`).

---

## 2. كيفاش تستعمل MinIO باخ تشوف واش الـ upload وقع ولا لا (detailed)

MinIO هو « object storage » (باخ تصيفي الملفات)، شبيه بـ S3. الـ API ديالك كيْعطي رابط من نوع:
`http://localhost:9000/cv/{candidateId}`  
والـ n8n كيْبعث الـ CV بـ PUT على هاد الرابط. فْ MinIO الـ « bucket » هو `cv` والـ « object » هو الـ `candidateId`.

### 2.1 تْثبت وتْشغّل MinIO (Docker — الأسهل)

1. **تأكد بلي Docker مْثبّت وْ خدّام**  
   فْ الطرفية:
   ```bash
   docker --version
   ```

2. **شغّل MinIO فْ container**  
   وْاحد الـ port 9000 (API) وْ 9001 (Console ويب باخ تشوف الملفات):
   ```bash
   docker run -d --name minio-cv -p 9000:9000 -p 9001:9001 -e "MINIO_ROOT_USER=minioadmin" -e "MINIO_ROOT_PASSWORD=minioadmin" minio/minio server /data --console-address ":9001"
   ```

3. **فتح الـ Console (واجهة ويب)**  
   فْ المتصفح:  
   **http://localhost:9001**  
   - Login: `minioadmin`  
   - Password: `minioadmin`

4. **تْسَنّى bucket اسمه `cv`**  
   - من الـ Console: **Buckets** → **Create Bucket**  
   - Name: `cv`  
   - Create.

5. **تْخلي الـ bucket يقبل الـ PUT (upload) بدون auth**  
   هاد الـ setup للـ test باخ الـ n8n يقدّر يْبعث الـ CV مباشرة على `http://localhost:9000/cv/xxx`:  
   - ادخل للـ bucket `cv`  
   - **Access Rules** / **Anonymous** (أو **Manage** → **Access**)  
   - خلي **Read + Write** للـ anonymous، وْلا خصّك تْستعمل **Policy** مخصصة تْسمح بالـ PUT على الـ prefix `cv/`.  

   (فْ نسخ قديمة ديال MinIO: **Anonymous** من **Bucket** → **Manage** → نْضيف policy تْسمح بـ `s3:PutObject` على هاد الـ bucket.)

   **بديل بسيط للـ test:**  
   فْ MinIO جديد، من **Buckets** → **cv** → **Access** يمكن تلقي خيار **Public** أو **Custom**: خلي الـ bucket يْقبل **Put** من خارج (أي واحد يقدّر يْبعث ملف).  
   إلا الـ Console ما عْطاكش anonymous Put، يمكن تْستعمل **Service Account** وْ تعطي الـ n8n الـ credentials؛ للـ test، الـ أسهل هو policy على الـ bucket `cv`:
   - Action: `s3:PutObject`, `s3:GetObject`
   - Resource: `arn:aws:s3:::cv/*`
   - Principal: `*` (للـ test فقط).

6. **تشغيل الـ workflow**  
   - شغّل الـ API (port 3005).  
   - شغّل n8n وْ استورد الـ workflow، سِلّم Gmail، دير **Execute workflow** (أو Fetch Test Event ثم Execute).  
   - بعد ما الـ workflow يْكمّل، روح لـ **http://localhost:9001** → bucket **cv** → غادي تشوف object باسم الـ `candidateId` (مثلاً `mock-1772040593473-pirlfm`). هادا هو الـ CV لي تْuploada.

### 2.2 كيفاش تتأكد بلي الـ upload وقع (detailed)

1. **من n8n**  
   - الـ node **« 3 - Upload CV to MinIO »** يكون فيه **checkmark أخضر** = الـ PUT تْنجم.  
   - إلا فيه **warning/error**، افتح الـ node وْ شوف الـ error message (مثلاً connection refused = MinIO غير خدّام، ولا 403 = الـ bucket ما كيْقبلش الـ PUT).

2. **من MinIO Console**  
   - ادخل **http://localhost:9001** → Login.  
   - **Buckets** → **cv**.  
   - غادي تشوف قائمة الـ **Objects**: كل اسم ديال object (مثلاً `mock-1772040593473-pirlfm`) هو الـ CV لي تْبعث.  
   - كليك على الـ object → **Download** باخ تْفتح الـ PDF وتتأكد بلي هو الـ CV.

3. **من الـ API (backend)**  
   - الـ API كيْطبع فْ الـ console شي حاجة بحال:  
     `[test/candidatures] Mock candidate created: { id: 'mock-...', email: '...', fullName: '...' }`  
   - الـ `id` / `candidateId` هو نفس الـ اسم ديال الـ object فْ MinIO.

### 2.3 إلا ما عندكش Docker

- تقدر تْثبت **MinIO binary** من: https://min.io/download  
- تشغّلو محلياً على الـ port 9000 وْ 9001 (نفس الـ options فوق).  
- الـ خطوات ديال الـ bucket `cv` وْ الـ access (Put) وْ الـ Console (9001) نفس الشي.

### 2.4 ملخص سريع

| الهدف | الإجراء |
|------|---------|
| تشغيل MinIO | `docker run -d ... minio/minio server /data --console-address ":9001"` (أو MinIO binary). |
| تشوف الملفات (Console) | http://localhost:9001 → Login → Bucket **cv** → Objects. |
| تتأكد الـ upload | وجود object باسم الـ `candidateId` فْ bucket **cv** + الـ node « 3 - Upload CV to MinIO » أخضر فْ n8n. |
| الـ API يعطي الرابط | الـ API كيْرجع `uploadUrl = http://localhost:9000/cv/{id}`؛ الـ n8n كيْبعث الـ CV بـ PUT على هاد الرابط. |

---

## 3. ترتيب التشغيل (résumé)

1. شغّل **MinIO** (Docker أو binary) — ports 9000 وْ 9001.  
2. سنّى bucket **cv** وْ خلي الـ Put مسموح (policy أو anonymous للـ test).  
3. شغّل **الـ API**: `node server/index.js`.  
4. فْ n8n: Import الـ workflow، Gmail credential، Execute (أو Fetch Test Event ثم Execute).  
5. تأكد: MinIO Console → bucket **cv** → تشوف الـ object (الـ CV) بالـ ID ديال الـ candidate.

هاد الـ document هو الـ procedure كاملة وْ كيفاش تستعمل MinIO باخ تشوف بالتفصيل واش الـ upload وقع ولا لا.
