# MinIO بدون Docker — تشوف الـ CVs المْuploadin

هاد الـ guide كيْشرح كيفاش تْثبت وتْشغّل MinIO على Windows **بدون Docker**، باخ تشوف الـ CVs لي كيْuploadaw من n8n.

---

## 1. تنزيل MinIO (binary)

1. روح لـ: **https://min.io/download**  
   ولا مباشرة: **https://dl.minio.io/server/minio/release/windows-amd64/minio.exe**

2. نزّل الملف **minio.exe** وْ حطّه فْ مكان مْعيَّن، مثلاً:
   ```
   C:\minio\minio.exe
   ```
   ولا فْ الـ project:
   ```
   c:\Users\DELL\Desktop\Automated CV Analysis from Gmail to HR Email\minio\minio.exe
   ```

3. (اختياري) سنّي متغير بيئي **PATH** باخ تقدر تشغّل `minio` من أي طرفية، ولا استعمل الـ path الكامل فْ الأوامر.

---

## 2. تشغيل MinIO

1. **سنّي dossier** باخ MinIO يْخزّن فيه الـ data (الملفات). مثلاً:
   ```
   C:\minio-data
   ```
   ولا فْ الـ project:
   ```
   c:\Users\DELL\Desktop\Automated CV Analysis from Gmail to HR Email\server\data\minio
   ```

2. **فتح PowerShell أو CMD** وْ شغّل:

   **إلا minio.exe فْ C:\minio\:**
   ```cmd
   C:\minio\minio.exe server C:\minio-data --console-address ":9001"
   ```

   **إلا حطيتو فْ الـ project:**
   ```cmd
   cd "c:\Users\DELL\Desktop\Automated CV Analysis from Gmail to HR Email"
   .\minio\minio.exe server .\server\data\minio --console-address ":9001"
   ```

3. خصّك تشوف شي حاجة بحال:
   ```
   API: http://localhost:9000
   Console: http://localhost:9001
   RootUser: minioadmin
   RootPass: minioadmin
   ```
   خلي هاد النافذة مْفتوحة — MinIO كيْخدم مادام هادي مْقفولاش.

---

## 3. فتح الـ Console باخ تشوف الملفات

1. فْ المتصفح افتح: **http://localhost:9001**

2. **Login:**
   - Root User: `minioadmin`
   - Root Password: `minioadmin`

3. **تْسَنّى bucket اسمه `cv`:**
   - من اليسار: **Buckets** → **Create Bucket**
   - Name: `cv`
   - Create

4. **تْخلي الـ bucket يْقبل الـ PUT (upload) من n8n:**
   - ادخل للـ bucket **cv**
   - **Access** أو **Manage** → **Access Rules** / **Anonymous**
   - خلي **Read + Write** للـ public (للـ test فقط)، وْلا سنّي **Policy**:
     - Resource: `cv/*`
     - Actions: `s3:PutObject`, `s3:GetObject`
     - Principal: `*`

   (فْ نسخ جديدة ديال MinIO، من **Buckets** → **cv** → **Manage** يمكن تلقي **Anonymous** أو **Policy** — خلي الـ Put مسموح.)

---

## 4. تشغيل الـ workflow وْ التأكد

1. شغّل **الـ API**: `node server/index.js` (port 3005).
2. شغّل **MinIO** (الخطوة 2 فوق).
3. فْ n8n: **Execute workflow** (أو Fetch Test Event ثم Execute).

4. **باخ تشوف واش الـ CV تْuploada:**
   - روح **http://localhost:9001** → Login → **Buckets** → **cv**
   - غادي تشوف الـ **objects** (أسماء بحال `mock-1772040593473-pirlfm`)
   - كل اسم = ملف CV واحد. كليك عليه → **Download** باخ تْفتح الـ PDF.

---

## 5. تشغيل MinIO بـ script (اختياري)

تقدر تحط **start-minio.bat** فْ الـ project (انظر الملف تحت) وْ تكليك عليه باخ يْشغّل MinIO بدون ما تْفتح الطرفية يدوياً.

---

## ملخص

| الهدف              | الإجراء |
|--------------------|--------|
| تنزيل MinIO        | https://dl.minio.io/server/minio/release/windows-amd64/minio.exe |
| تشغيل MinIO        | `minio.exe server C:\minio-data --console-address ":9001"` |
| تشوف الملفات       | http://localhost:9001 → Login → Bucket **cv** → Objects |
| بدون Docker        | استعمل **minio.exe** (binary) فقط، بدون أي container. |
