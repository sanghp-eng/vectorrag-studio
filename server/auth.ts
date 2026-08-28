import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { addDocument, getUserDocuments } from './vectorStore.js';

const DATA_DIR = path.join(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const USERS_FILE = path.join(DATA_DIR, 'users.json');
const JWT_SECRET = process.env.JWT_SECRET || 'vector_rag_secure_jwt_secret_2026_x89f!';

export interface UserRecord {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  customGeminiApiKey?: string;
  createdAt: string;
}

let users: UserRecord[] = [];

try {
  if (fs.existsSync(USERS_FILE)) {
    users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8'));
  }
} catch (e) {
  console.error('Error loading users:', e);
}

function persistUsers() {
  try {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
  } catch (e) {
    console.error('Error persisting users:', e);
  }
}

export function getUserApiKey(userId: string): string | undefined {
  const u = users.find(user => user.id === userId);
  return u?.customGeminiApiKey;
}

export function setUserApiKey(userId: string, apiKey: string | null): void {
  const u = users.find(user => user.id === userId);
  if (u) {
    if (apiKey) {
      u.customGeminiApiKey = apiKey.trim();
    } else {
      delete u.customGeminiApiKey;
    }
    persistUsers();
  }
}

// Seed sample knowledge base documents into a user's account
export async function seedSampleKnowledgeBase(userId: string) {
  const existing = getUserDocuments(userId);
  if (existing.length > 0) return; // already has docs

  const sampleDoc1 = {
    title: 'Kiến trúc RAG & Vector Database Hiện đại (2026)',
    category: 'AI & Engineering',
    tags: ['RAG', 'VectorDB', 'Embeddings', 'Gemini'],
    content: `Retrieval-Augmented Generation (RAG) là một kiến trúc trí tuệ nhân tạo kết hợp mô hình ngôn ngữ lớn (LLM) với hệ thống truy xuất thông tin từ cơ sở dữ liệu vector.
Mục tiêu cốt lõi của RAG là khắc phục hiện tượng ảo giác (hallucination), cập nhật kiến thức thời gian thực mà không cần huấn luyện lại toàn bộ mô hình (fine-tuning), và cung cấp nguồn trích dẫn đáng tin cậy.

Quy trình hoạt động của RAG gồm 3 bước chính:
1. Ingestion (Nạp dữ liệu & Chunking): Tài liệu thô được phân chia thành các khối văn bản nhỏ (chunks) theo đoạn văn, kích thước cố định có chồng lấn (overlap), hoặc ngữ nghĩa câu. Sau đó, mỗi chunk được chuyển thành vector embedding đa chiều thông qua mô hình như Gemini Embedding.
2. Retrieval (Truy xuất Vector): Khi người dùng gửi câu hỏi, truy vấn được biến đổi thành query vector. Vector database tính toán độ tương tự cosine similarity hoặc Euclidean distance để chọn ra Top-K chunks có điểm liên quan cao nhất.
3. Generation (Sinh phản hồi có cơ sở): Context từ Top-K chunks được ghép vào prompt kèm câu hỏi ban đầu. LLM như Gemini 3.7 Flash đọc ngữ cảnh và tổng hợp câu trả lời chính xác, kèm số thứ tự trích dẫn nguồn [1], [2].

Lợi ích bảo mật và kiểm soát:
- Doanh nghiệp có thể phân quyền truy cập dữ liệu (RBAC) tới từng phân đoạn tài liệu.
- Dữ liệu mật không bị gửi vào tập dữ liệu huấn luyện công khai.`,
  };

  const sampleDoc2 = {
    title: 'Chính sách Bảo mật Thông tin & Xác thực Người dùng (ISO/IEC 27001)',
    category: 'Security & Compliance',
    tags: ['Security', 'Auth', 'JWT', 'Encryption'],
    content: `Tiêu chuẩn An toàn thông tin doanh nghiệp yêu cầu triển khai mô hình Zero Trust Architecture cho tất cả các giao diện truy cập API và kho dữ liệu vector.
Nguyên tắc xác thực và phân quyền:
- Mọi yêu cầu truy xuất tài liệu phải mang theo JSON Web Token (JWT) hợp lệ qua header Authorization: Bearer <token>.
- Mật khẩu người dùng được băm bằng thuật toán Bcrypt với hệ số salt work factor tối thiểu là 10.
- Khóa bảo mật JWT Secret được quản lý trong biến môi trường bảo mật, thời hạn token truy cập (Access Token) tối đa là 7 ngày.

Kiểm soát phân vùng dữ liệu đa người dùng (Multi-tenancy Data Isolation):
- Mỗi vector chunk trong cơ sở dữ liệu vector được gán nhãn userId và workspaceId.
- Không gian vector của từng người dùng được cô lập tuyệt đối, truy vấn từ người dùng A không bao giờ quét qua dữ liệu của người dùng B.
- Nhật ký truy xuất (Audit Log) ghi lại thời gian, địa chỉ IP, và tài liệu được tham chiếu trong mỗi phiên RAG.`,
  };

  const sampleDoc3 = {
    title: 'Hướng dẫn Tối ưu Hóa Truy xuất Ngữ nghĩa & Chunking Strategy',
    category: 'Best Practices',
    tags: ['Optimization', 'Chunking', 'CosineSimilarity', 'Re-ranking'],
    content: `Chiến lược phân đoạn tài liệu (Chunking Strategy) quyết định 70% độ chính xác của hệ thống RAG:
1. Kích thước Chunk (Chunk Size): Thường từ 250 đến 500 ký tự cho văn bản Q&A chi tiết, hoặc 800 - 1200 ký tự cho tài liệu pháp lý phức tạp.
2. Độ chồng lấn (Chunk Overlap): Đặt từ 10% đến 20% kích thước chunk (ví dụ 40-60 ký tự) để đảm bảo không bị đứt đoạn ngữ nghĩa giữa các ranh giới câu.
3. Độ tương tự Cosine (Cosine Similarity Threshold): 
- Điểm tương tự > 0.85: Ngữ nghĩa rất khớp, độ tin cậy tuyệt đối.
- Điểm từ 0.70 đến 0.85: Ngữ cảnh liên quan cao, thích hợp đưa vào prompt tổng hợp.
- Điểm < 0.60: Thông tin có thể bị loãng hoặc lệch chủ đề, nên lọc bỏ nếu bật Strict Grounding mode.

Kỹ thuật Re-ranking & Context Compression:
Sau khi lấy Top-K từ vector search, có thể áp dụng thuật toán lọc lại để sắp xếp các đoạn quan trọng nhất lên đầu prompt, giúp LLM tập trung vào ý chính và giảm lượng token tiêu thụ.`,
  };

  const sampleDoc4 = {
    title: 'SOP & Runbook Xử lý Sự cố Máy chủ & Cảnh báo Zabbix Monitoring (DevOps & SysAdmin)',
    category: 'IT & DevOps Runbooks',
    tags: ['Zabbix', 'DevOps', 'Runbook', 'Troubleshooting', 'Linux', 'MySQL', 'Nginx'],
    content: `Quy trình Chuẩn (SOP) tiếp nhận và khắc phục các cảnh báo thường gặp từ hệ thống Zabbix Monitoring:

1. CẢNH BÁO: DISK SPACE IS CRITICALLY LOW (>90%) TRÊN /var/log HOẶC /
- Nguyên nhân: Log xoay vòng thất bại (logrotate failed), core dump file tích tụ hoặc database binary log quá lớn.
- Các bước xử lý:
  Bước 1: Chạy lệnh 'df -h' để xác định phân vùng bị đầy.
  Bước 2: Tìm top thư mục chiếm dung lượng lớn: 'du -sh /var/log/* | sort -hr | head -n 10'.
  Bước 3: Dọn dẹp log cũ an toàn: 'journalctl --vacuum-time=3d' hoặc nén archive log cũ. Không dùng lệnh 'rm' trực tiếp khi service đang mở file write handle; thay vào đó dùng 'truncate -s 0 /var/log/app.log'.
  Bước 4: Kiểm tra lại Zabbix agent: 'zabbix_get -s 127.0.0.1 -k vfs.fs.size[/,pused]'.

2. CẢNH BÁO: HIGH CPU UTILIZATION (>95%) HOẶC OUT OF MEMORY (OOM)
- Nguyên nhân: Tiến trình chạy vòng lặp vô tận, rò rỉ bộ nhớ (memory leak) hoặc bị tấn công DoS/Brute-force.
- Các bước xử lý:
  Bước 1: Kiểm tra tổng quan: 'top -c' hoặc 'htop', bấm 'P' để sort CPU, 'M' để sort RAM.
  Bước 2: Kiểm tra dmesg xem có tiến trình nào bị OOM Killer dừng không: 'dmesg -T | grep -i oom'.
  Bước 3: Tối ưu service hoặc restart service bị crash: 'systemctl status <service>' -> 'systemctl restart <service>'.

3. CẢNH BÁO: MYSQL SERVICE DOWN & CONNECTION REFUSED (PORT 3306)
- Nguyên nhân: MySQL bị OOM kill do innodb_buffer_pool_size cấu hình vượt quá dung lượng RAM thực, hoặc deadlock crash.
- Các bước xử lý:
  Bước 1: Kiểm tra error log MySQL: 'tail -n 100 /var/log/mysql/error.log'.
  Bước 2: Khởi động lại an toàn: 'systemctl restart mysql'.
  Bước 3: Kiểm tra số lượng kết nối đang mở: 'mysqladmin processlist' và điều chỉnh 'max_connections' trong my.cnf nếu cần.

4. CẢNH BÁO: NGINX / WEB SERVICE 502 BAD GATEWAY
- Nguyên nhân: Upstream backend (Node.js, PHP-FPM, Python Gunicorn) bị treo hoặc socket bị quá tải.
- Các bước xử lý:
  Bước 1: Kiểm tra nginx error log: 'tail -f /var/log/nginx/error.log'.
  Bước 2: Xác nhận backend upstream service đang lắng nghe: 'netstat -tulnp | grep 3000'.
  Bước 3: Reload nginx cấu hình: 'nginx -t && systemctl reload nginx'.`,
  };

  await addDocument(userId, sampleDoc1.title, sampleDoc1.content, sampleDoc1.category, sampleDoc1.tags, 'paragraph');
  await addDocument(userId, sampleDoc2.title, sampleDoc2.content, sampleDoc2.category, sampleDoc2.tags, 'paragraph');
  await addDocument(userId, sampleDoc3.title, sampleDoc3.content, sampleDoc3.category, sampleDoc3.tags, 'semantic_sentence');
  await addDocument(userId, sampleDoc4.title, sampleDoc4.content, sampleDoc4.category, sampleDoc4.tags, 'paragraph');
}

// Initialize demo user if not exists
export async function ensureDemoUser() {
  const demoEmail = 'demo@ragstudio.ai';
  let demoUser = users.find(u => u.email === demoEmail);
  if (!demoUser) {
    const passwordHash = await bcrypt.hash('ragstudio123', 10);
    demoUser = {
      id: 'usr_demo_admin_001',
      email: demoEmail,
      name: 'Demo Admin RAG',
      passwordHash,
      createdAt: new Date().toISOString(),
    };
    users.push(demoUser);
    persistUsers();
  }
  await seedSampleKnowledgeBase(demoUser.id);

  // Seed sample API key for demo user if none exists
  try {
    const { getUserApiKeys, createExternalApiKey } = await import('./apiKeys.js');
    const existingKeys = getUserApiKeys(demoUser.id);
    if (existingKeys.length === 0) {
      createExternalApiKey(demoUser.id, 'Zabbix Chatbot Monitoring Client', ['read_rag', 'search_vector']);
    }
  } catch (e) {
    console.error('Error seeding demo API key:', e);
  }
}

// Ensure demo user runs on module load
ensureDemoUser().catch(console.error);

export function generateToken(user: UserRecord): string {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      name: user.name,
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    name: string;
  };
}

export function findUserById(userId: string): UserRecord | undefined {
  return users.find(u => u.id === userId);
}

export function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  // Check for X-API-Key header first
  const apiKeyHeader = req.headers['x-api-key'] as string | undefined;
  const authHeader = req.headers.authorization;

  let rawApiKey = apiKeyHeader;
  if (!rawApiKey && authHeader && authHeader.startsWith('Bearer rag_sk_live_')) {
    rawApiKey = authHeader.substring(7);
  }

  // If using an External API Key (e.g. from Zabbix, Curl, LangChain)
  if (rawApiKey && rawApiKey.startsWith('rag_sk_live_')) {
    const { validateApiKey } = require('./apiKeys.js');
    const result = validateApiKey(rawApiKey);
    if (!result.valid || !result.userId) {
      return res.status(401).json({ error: result.error || 'API Key không hợp lệ hoặc đã bị vô hiệu hóa.' });
    }

    const matchedUser = findUserById(result.userId);
    req.user = {
      id: result.userId,
      email: matchedUser?.email || 'api-client@external',
      name: matchedUser?.name || result.keyInfo?.name || 'External API Client',
    };
    return next();
  }

  // Otherwise check standard Bearer JWT Token
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Chưa đăng nhập hoặc thiếu token xác thực. Cần cung cấp Header Authorization: Bearer <TOKEN> hoặc X-API-Key: rag_sk_live_...',
    });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { id: string; email: string; name: string };
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token không hợp lệ hoặc đã hết hạn.' });
  }
}

// User controller functions
export async function registerUser(email: string, password: string, name: string) {
  const existing = users.find(u => u.email.toLowerCase() === email.toLowerCase());
  if (existing) {
    throw new Error('Email này đã được đăng ký.');
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const newUser: UserRecord = {
    id: 'usr_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36),
    email: email.toLowerCase(),
    name: name || email.split('@')[0],
    passwordHash,
    createdAt: new Date().toISOString(),
  };

  users.push(newUser);
  persistUsers();

  // Pre-seed starter sample docs for new user
  await seedSampleKnowledgeBase(newUser.id);

  const token = generateToken(newUser);
  return {
    user: {
      id: newUser.id,
      email: newUser.email,
      name: newUser.name,
      createdAt: newUser.createdAt,
    },
    token,
  };
}

export async function loginUser(email: string, password: string) {
  const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());
  if (!user) {
    throw new Error('Email hoặc mật khẩu không chính xác.');
  }

  const isMatch = await bcrypt.compare(password, user.passwordHash);
  if (!isMatch) {
    throw new Error('Email hoặc mật khẩu không chính xác.');
  }

  const token = generateToken(user);
  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      createdAt: user.createdAt,
    },
    token,
  };
}

export function getDemoCredentials() {
  const demoUser = users.find(u => u.email === 'demo@ragstudio.ai');
  if (!demoUser) return null;
  const token = generateToken(demoUser);
  return {
    user: {
      id: demoUser.id,
      email: demoUser.email,
      name: demoUser.name,
      createdAt: demoUser.createdAt,
    },
    token,
  };
}
