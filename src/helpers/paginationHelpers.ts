export default function paginationHelpers(options: { 
    page?: number; 
    limit?: number; 
    sortBy?: string; 
    sortOrder?: 'DESC' | 'ASC'; 
  }) {
    const page = Number(options.page || 1);
    const limit = Number(options.limit || 10);
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
  