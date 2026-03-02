
export enum Category {
  ACTUALIDAD = 'Actualidad',
  CRONICAS = 'Crónicas',
  ENTREVISTAS = 'Entrevistas',
  OPINION = 'Opinión'
}

export type SystemRole = 'ADMIN' | 'EDITOR';

export interface Author {
  id: string;
  name: string;
  role: string; // Cargo visible (ej: "Redactor Jefe")
  imageUrl?: string;
  systemRole: SystemRole; // Permisos del sistema (ADMIN o EDITOR)
  lastModified?: string;
}

export interface BullfightResult {
  bullfighter: string;
  result: string;
}

export interface GalleryImage {
  url: string;
  caption: string;
  credit?: string; // Autor de la foto de galería
}

export interface Article {
  id: string;
  title: string;
  summary?: string;
  content: string;
  imageUrl: string;
  imageCaption?: string; // Pie de foto de portada
  photoCredit?: string;  // Autor de la foto de portada
  contentImages?: GalleryImage[]; // Array de objetos con url, caption y credit
  category: Category;
  authorId: string;
  date: string;
  isPublished: boolean; // true = Publicada/Aprobada, false = Borrador/Pendiente
  lastModified?: string;
  
  // Campos específicos para Crónicas
  bullfightLocation?: string;
  bullfightCattle?: string;
  bullfightSummary?: string;
  bullfightResults?: BullfightResult[];
}

// Extensión para el historial
export interface ArchivedArticle extends Article {
  archivedAt: string;
  archivedBy: string; // ID del usuario que la eliminó
}

export interface DashboardStats {
  totalArticles: number;
  totalAuthors: number;
  recentArticles: Article[];
}

export interface AppSettings {
  githubToken: string;
  repoOwner: string;
  repoName: string;
  filePath: string;
  repoBranch?: string;
  vercelDeployHook?: string;
}
