export interface PageRequest {
  page: number;
  pageSize: number;
  offset: number;
}

export function parsePage(
  query: Record<string, unknown>,
  defaultSize = 20,
  maxSize = 100,
): PageRequest {
  const page = Math.max(1, Number.parseInt(String(query.page ?? '1'), 10) || 1);
  const requested = Number.parseInt(String(query.pageSize ?? defaultSize), 10) || defaultSize;
  const pageSize = Math.min(maxSize, Math.max(1, requested));
  return { page, pageSize, offset: (page - 1) * pageSize };
}

export function pageInfo(req: PageRequest, total: number) {
  return {
    page: req.page,
    pageSize: req.pageSize,
    total,
    totalPages: Math.ceil(total / req.pageSize),
  };
}
