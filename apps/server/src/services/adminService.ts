import { prisma } from '../db/prisma';
import { config } from '../config/env';

export interface AdminRecord {
  id: string;
  email: string;
  password?: string | null;
  role: 'owner' | 'admin';
  added_by?: string | null;
  created_at: Date;
}

export const OWNER_EMAIL = 'palisettisunitha@gmail.com';
export const OWNER_PASSWORD = config.adminPassword || 'toman@12112';

class AdminService {
  private memoryAdmins: Set<string> = new Set([OWNER_EMAIL.toLowerCase()]);
  private memoryAdminPasswords: Map<string, string> = new Map([
    [OWNER_EMAIL.toLowerCase(), OWNER_PASSWORD.trim()],
  ]);

  constructor() {
    this.init().catch((err) => {
      console.warn('AdminService init notice:', err.message);
    });
  }

  public async init() {
    try {
      // Ensure owner is in database
      const existingOwner = await prisma.adminEmail.findUnique({
        where: { email: OWNER_EMAIL.toLowerCase() },
      });

      if (!existingOwner) {
        await prisma.adminEmail.create({
          data: {
            email: OWNER_EMAIL.toLowerCase(),
            password: OWNER_PASSWORD.trim(),
            role: 'owner',
            added_by: 'system',
          },
        });
      } else if (!existingOwner.password) {
        await prisma.adminEmail.update({
          where: { email: OWNER_EMAIL.toLowerCase() },
          data: { password: OWNER_PASSWORD.trim() },
        });
      }

      // Load all admins and passwords into memory cache
      const all = await prisma.adminEmail.findMany();
      this.memoryAdmins.clear();
      this.memoryAdminPasswords.clear();
      this.memoryAdmins.add(OWNER_EMAIL.toLowerCase());
      this.memoryAdminPasswords.set(OWNER_EMAIL.toLowerCase(), OWNER_PASSWORD.trim());

      for (const a of all) {
        const clean = a.email.toLowerCase();
        this.memoryAdmins.add(clean);
        if (a.password) {
          this.memoryAdminPasswords.set(clean, a.password.trim());
        }
      }
    } catch (e: any) {
      console.warn('AdminService init fallback:', e.message);
      this.memoryAdmins.add(OWNER_EMAIL.toLowerCase());
      this.memoryAdminPasswords.set(OWNER_EMAIL.toLowerCase(), OWNER_PASSWORD.trim());
    }
  }

  public isOwner(email?: string | null): boolean {
    if (!email) return false;
    return email.trim().toLowerCase() === OWNER_EMAIL.toLowerCase();
  }

  public isAdminSync(email?: string | null): boolean {
    if (!email) return false;
    const clean = email.trim().toLowerCase();
    return clean === OWNER_EMAIL.toLowerCase() || this.memoryAdmins.has(clean);
  }

  public async isAdmin(email?: string | null): Promise<boolean> {
    if (!email) return false;
    const clean = email.trim().toLowerCase();
    if (clean === OWNER_EMAIL.toLowerCase()) return true;
    if (this.memoryAdmins.has(clean)) return true;

    try {
      const found = await prisma.adminEmail.findUnique({
        where: { email: clean },
      });
      if (found) {
        this.memoryAdmins.add(clean);
        if (found.password) {
          this.memoryAdminPasswords.set(clean, found.password.trim());
        }
        return true;
      }
    } catch {}

    return false;
  }

  public async verifyAdminPassword(email: string, password?: string): Promise<boolean> {
    if (!password) return false;
    const cleanEmail = email.trim().toLowerCase();
    const cleanPass = password.trim();

    if (cleanEmail === OWNER_EMAIL.toLowerCase()) {
      return cleanPass === OWNER_PASSWORD.trim();
    }

    if (this.memoryAdminPasswords.has(cleanEmail)) {
      const stored = this.memoryAdminPasswords.get(cleanEmail);
      return cleanPass === stored;
    }

    try {
      const record = await prisma.adminEmail.findUnique({
        where: { email: cleanEmail },
      });
      if (record && record.password) {
        this.memoryAdminPasswords.set(cleanEmail, record.password.trim());
        return cleanPass === record.password.trim();
      }
    } catch {}

    return false;
  }

  public async listAdmins(): Promise<AdminRecord[]> {
    try {
      const records = await prisma.adminEmail.findMany({
        orderBy: { created_at: 'asc' },
      });

      const hasOwner = records.some((r) => r.email.toLowerCase() === OWNER_EMAIL.toLowerCase());
      if (!hasOwner) {
        return [
          {
            id: 'owner-root',
            email: OWNER_EMAIL.toLowerCase(),
            password: '••••••••',
            role: 'owner',
            added_by: 'system',
            created_at: new Date(),
          },
          ...records.map((r) => ({
            id: r.id,
            email: r.email,
            password: r.password || null,
            role: (r.role as 'owner' | 'admin') || 'admin',
            added_by: r.added_by,
            created_at: r.created_at,
          })),
        ];
      }

      return records.map((r) => ({
        id: r.id,
        email: r.email,
        password: r.email.toLowerCase() === OWNER_EMAIL.toLowerCase() ? '••••••••' : (r.password || null),
        role: r.email.toLowerCase() === OWNER_EMAIL.toLowerCase() ? 'owner' : ((r.role as any) || 'admin'),
        added_by: r.added_by,
        created_at: r.created_at,
      }));
    } catch (e) {
      return [
        {
          id: 'owner-root',
          email: OWNER_EMAIL.toLowerCase(),
          password: '••••••••',
          role: 'owner',
          added_by: 'system',
          created_at: new Date(),
        },
      ];
    }
  }

  public async addAdmin(
    email: string,
    password?: string,
    addedBy: string = OWNER_EMAIL
  ): Promise<{ success: boolean; data?: AdminRecord; error?: string }> {
    const clean = email.trim().toLowerCase();
    if (!clean || !clean.includes('@') || !clean.includes('.')) {
      return { success: false, error: 'Please enter a valid email address.' };
    }

    if (clean === OWNER_EMAIL.toLowerCase()) {
      return { success: false, error: 'This email is already the root Owner.' };
    }

    const cleanPass = password?.trim();
    if (!cleanPass || cleanPass.length < 4) {
      return { success: false, error: 'Please specify a password for this admin (at least 4 characters).' };
    }

    try {
      const existing = await prisma.adminEmail.findUnique({
        where: { email: clean },
      });

      if (existing) {
        return { success: false, error: `Email "${clean}" is already registered as an Admin.` };
      }

      const created = await prisma.adminEmail.create({
        data: {
          email: clean,
          password: cleanPass,
          role: 'admin',
          added_by: addedBy,
        },
      });

      this.memoryAdmins.add(clean);
      this.memoryAdminPasswords.set(clean, cleanPass);

      return {
        success: true,
        data: {
          id: created.id,
          email: created.email,
          password: cleanPass,
          role: 'admin',
          added_by: created.added_by,
          created_at: created.created_at,
        },
      };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to add admin email.' };
    }
  }

  public async removeAdmin(email: string): Promise<{ success: boolean; error?: string }> {
    const clean = email.trim().toLowerCase();
    if (clean === OWNER_EMAIL.toLowerCase()) {
      return { success: false, error: 'Cannot remove the primary Superadmin / Owner.' };
    }

    try {
      await prisma.adminEmail.deleteMany({
        where: { email: clean },
      });
      this.memoryAdmins.delete(clean);
      this.memoryAdminPasswords.delete(clean);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to remove admin.' };
    }
  }
}

export const adminService = new AdminService();
