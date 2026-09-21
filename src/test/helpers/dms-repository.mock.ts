export const createDmsRepositoryMock = () => ({
  create: jest.fn((value) => value),
  save: jest.fn(async (value) => ({ id: 'dms-record-id', ...value })),
  findOne: jest.fn(),
  merge: jest.fn((existing, update) => ({ ...existing, ...update })),
  createQueryBuilder: jest.fn(),
  count: jest.fn(),
});
