export default function paginationHelpers(options: { 
    page?: number; 
    limit?: number; 
    sortBy?: string; 
    sortOrder?: 'DESC' | 'ASC'; 
  }) {
    // Bound user-controlled pagination so one request cannot force a large
    // table scan or serialize an unsafe number of orders into memory.
    const requestedPage = Number(options.page || 1);
    const requestedLimit = Number(options.limit || 10);
    const page = Number.isFinite(requestedPage) ? Math.max(1, requestedPage) : 1;
    const limit = Number.isFinite(requestedLimit)
      ? Math.min(100, Math.max(1, requestedLimit))
      : 10;
    const skip = (page - 1) * limit;
    const sortBy = options.sortBy || 'createdAt';
    const sortOrder: 'DESC' | 'ASC' = options.sortOrder || 'DESC'; // Default to 'DESC'
    return {
      page,
      limit,
      skip,
      sortBy,
      sortOrder,
    };
  }
  
