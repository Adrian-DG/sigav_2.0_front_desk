/** Mirrors Application/Common/Models/PagedResult.cs (todos los listados paginados de la API). */
export type PagedResult<T> = {
  items: T[];
  page: number;
  size: number;
  totalCount: number;
  totalPages: number;
};
