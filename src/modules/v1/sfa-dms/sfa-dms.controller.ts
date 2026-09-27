import { BadRequestException, Body, Controller, Get, HttpStatus, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { SfaDmsService } from './sfa-dms.service';
import { ApiBody, ApiHeader, ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';

@ApiTags('SFA / DMS')
@ApiHeader({ name: 'x-organization-id', required: true, description: 'Organization UUID. Must match the JWT organization for guarded clients.' })
@Controller('v1/sfa-dms')
export class SfaDmsController {
  constructor(private readonly service: SfaDmsService) {}

  private organizationId(req: any): string {
    const organizationId = req.headers['x-organization-id'];
    if (!organizationId || typeof organizationId !== 'string') {
      throw new BadRequestException('x-organization-id header is required');
    }
    return organizationId;
  }

  // --- DASHBOARD & REPORTS ---
  @Get('dashboard')
  async dashboard(@Req() req: any) {
    return { success: true, statusCode: HttpStatus.OK, data: await this.service.dashboard(this.organizationId(req)) };
  }

  @Get('reports/targets-achievement')
  @ApiOperation({ summary: 'Get sales-target achievement by period and optional sales representative' })
  @ApiQuery({ name: 'period', required: false, example: '2026-09' })
  @ApiQuery({ name: 'salesRepId', required: false, example: '<sales-representative-uuid>' })
  async targetsAchievementReport(@Query() query: any, @Req() req: any) {
    const data = await this.service.getTargetsAchievementReport(this.organizationId(req), query.period, query.salesRepId);
    return { success: true, statusCode: HttpStatus.OK, data };
  }

  @Get('reports/distributor-stock')
  async distributorStockReport(@Query() query: any, @Req() req: any) {
    const data = await this.service.getDistributorStockReport(this.organizationId(req), query.distributorId);
    return { success: true, statusCode: HttpStatus.OK, data };
  }

  // --- SECONDARY SALES ORDERS ---
  @Post('orders/create-with-items')
  @ApiOperation({ summary: 'Create a secondary sales order and its line items atomically' })
  @ApiBody({ schema: { example: { retailerId: '<retailer-uuid>', orderDate: '2026-09-23', orderNumber: 'SO-20260923-001', discountAmount: 50, items: [{ productId: '<product-uuid>', quantity: 2, unitPrice: 450, discountAmount: 0, taxAmount: 0 }] } } })
  async createSalesOrderWithItems(@Body() data: any, @Req() req: any) {
    const result = await this.service.createSalesOrderWithItems(this.organizationId(req), data, req.user?.userId);
    return { success: true, statusCode: HttpStatus.CREATED, data: result };
  }

  @Get('orders/:id/items')
  async getOrderItems(@Param('id') id: string, @Req() req: any) {
    const items = await this.service.getOrderItems(id, this.organizationId(req));
    return { success: true, statusCode: HttpStatus.OK, data: items };
  }

  @Patch('orders/:id/status')
  @ApiOperation({ summary: 'Update secondary sales-order status' })
  @ApiBody({ schema: { example: { status: 'confirmed', note: 'Approved by sales manager' } } })
  async updateSalesOrderStatus(@Param('id') id: string, @Body() data: any, @Req() req: any) {
    const updated = await this.service.updateSalesOrderStatus(this.organizationId(req), id, data.status, req.user?.userId, data.note);
    return { success: true, statusCode: HttpStatus.OK, data: updated };
  }

  // --- PRIMARY SALES ORDERS (COMPANY -> DISTRIBUTOR) ---
  @Post('primary-orders/create-with-items')
  @ApiOperation({ summary: 'Create a company-to-distributor primary order and items atomically' })
  @ApiBody({ schema: { example: { distributorId: '<distributor-uuid>', orderDate: '2026-09-23', orderNumber: 'PO-20260923-001', items: [{ productId: '<product-uuid>', quantity: 24, unitPrice: 400 }] } } })
  async createPrimaryOrderWithItems(@Body() data: any, @Req() req: any) {
    const result = await this.service.createPrimaryOrderWithItems(this.organizationId(req), data, req.user?.userId);
    return { success: true, statusCode: HttpStatus.CREATED, data: result };
  }

  @Get('primary-orders/:id/items')
  async getPrimaryOrderItems(@Param('id') id: string, @Req() req: any) {
    const items = await this.service.getPrimaryOrderItems(id, this.organizationId(req));
    return { success: true, statusCode: HttpStatus.OK, data: items };
  }

  @Patch('primary-orders/:id/status')
  async updatePrimaryOrderStatus(@Param('id') id: string, @Body() data: any, @Req() req: any) {
    const updated = await this.service.updatePrimaryOrderStatus(this.organizationId(req), id, data.status, req.user?.userId);
    return { success: true, statusCode: HttpStatus.OK, data: updated };
  }

  // --- DISTRIBUTOR ONBOARDING ---
  @Patch('distributors/:id/onboarding')
  async updateDistributorOnboarding(@Param('id') id: string, @Body() data: any, @Req() req: any) {
    const updated = await this.service.updateDistributorOnboarding(
      this.organizationId(req),
      id,
      data.onboardingStatus,
      data.blockedReason,
      req.user?.userId,
    );
    return { success: true, statusCode: HttpStatus.OK, data: updated };
  }

  // --- FIELD ATTENDANCE & VISITS ---
  @Post('attendance/check-in')
  @ApiOperation({ summary: 'Record field-sales check-in; salesRepId defaults to signed-in user' })
  @ApiBody({ schema: { example: { salesRepId: '<sales-representative-uuid>', lat: 23.8103, lng: 90.4125, date: '2026-09-23' } } })
  async checkInAttendance(@Body() data: any, @Req() req: any) {
    const salesRepId = data.salesRepId || req.user?.userId;
    if (!salesRepId) throw new BadRequestException('salesRepId is required');
    const record = await this.service.checkInAttendance(this.organizationId(req), salesRepId, data.lat, data.lng, data.date);
    return { success: true, statusCode: HttpStatus.OK, data: record };
  }

  @Post('attendance/check-out')
  @ApiOperation({ summary: 'Record field-sales check-out' })
  @ApiBody({ schema: { example: { salesRepId: '<sales-representative-uuid>', lat: 23.8103, lng: 90.4125, date: '2026-09-23', remarks: 'Completed scheduled visits' } } })
  async checkOutAttendance(@Body() data: any, @Req() req: any) {
    const salesRepId = data.salesRepId || req.user?.userId;
    if (!salesRepId) throw new BadRequestException('salesRepId is required');
    const record = await this.service.checkOutAttendance(this.organizationId(req), salesRepId, data.lat, data.lng, data.date, data.remarks);
    return { success: true, statusCode: HttpStatus.OK, data: record };
  }

  @Post('field-visits/:id/check-in')
  async checkInFieldVisit(@Param('id') id: string, @Body() data: any, @Req() req: any) {
    const visit = await this.service.checkInFieldVisit(this.organizationId(req), id, data.lat, data.lng, req.user?.userId);
    return { success: true, statusCode: HttpStatus.OK, data: visit };
  }

  @Post('field-visits/:id/check-out')
  async checkOutFieldVisit(@Param('id') id: string, @Body() data: any, @Req() req: any) {
    const visit = await this.service.checkOutFieldVisit(this.organizationId(req), id, data, req.user?.userId);
    return { success: true, statusCode: HttpStatus.OK, data: visit };
  }

  // --- COLLECTIONS VERIFICATION ---
  @Patch('collections/:id/verify')
  async verifyCollection(@Param('id') id: string, @Body() data: any, @Req() req: any) {
    const updated = await this.service.verifyCollection(
      this.organizationId(req),
      id,
      data.status,
      data.depositDate,
      req.user?.userId,
      data.note,
    );
    return { success: true, statusCode: HttpStatus.OK, data: updated };
  }

  // --- DELIVERY TRIPS ---
  @Post('trips/create')
  async createDeliveryTrip(@Body() data: any, @Req() req: any) {
    const trip = await this.service.createDeliveryTrip(this.organizationId(req), data, req.user?.userId);
    return { success: true, statusCode: HttpStatus.CREATED, data: trip };
  }

  @Patch('trips/:id/status')
  async updateTripStatus(@Param('id') id: string, @Body() data: any, @Req() req: any) {
    const trip = await this.service.updateTripStatus(this.organizationId(req), id, data.status, data.orderDeliveries, req.user?.userId);
    return { success: true, statusCode: HttpStatus.OK, data: trip };
  }

  // --- RETURNS & CLAIMS ---
  @Post('returns/create-with-items')
  @ApiOperation({ summary: 'Create a retailer return with its returned items' })
  @ApiBody({ schema: { example: { retailerId: '<retailer-uuid>', returnDate: '2026-09-23', returnNumber: 'RTN-20260923-001', reason: 'Damaged goods', items: [{ productId: '<product-uuid>', quantity: 1, unitPrice: 450, reason: 'Damaged' }] } } })
  async createReturnWithItems(@Body() data: any, @Req() req: any) {
    const ret = await this.service.createReturnWithItems(this.organizationId(req), data, req.user?.userId);
    return { success: true, statusCode: HttpStatus.CREATED, data: ret };
  }

  // --- GENERIC CRUD FALLBACK ---
  @Get(':resource')
  @ApiOperation({ summary: 'List a supported SFA/DMS master-data resource' })
  @ApiParam({ name: 'resource', enum: ['regions', 'areas', 'territories', 'distributors', 'retailers', 'routes', 'attendance', 'visits', 'orders', 'primaryOrders', 'inventory', 'collections', 'schemes', 'trips', 'returns', 'targets'] })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  @ApiQuery({ name: 'searchTerm', required: false, example: 'Dhaka' })
  async list(@Param('resource') resource: string, @Query() query: any, @Req() req: any) {
    const result = await this.service.list(resource, this.organizationId(req), query.page, query.limit, query.searchTerm);
    return { success: true, statusCode: HttpStatus.OK, ...result };
  }

  @Get(':resource/:id')
  async getOne(@Param('resource') resource: string, @Param('id') id: string, @Req() req: any) {
    const data = await this.service.getOne(resource, id, this.organizationId(req));
    return { success: true, statusCode: HttpStatus.OK, data };
  }

  @Post(':resource')
  @ApiOperation({ summary: 'Create a supported SFA/DMS master-data record' })
  @ApiParam({ name: 'resource', enum: ['regions', 'areas', 'territories', 'distributors', 'retailers', 'routes', 'schemes'] })
  @ApiBody({ schema: { oneOf: [{ example: { code: 'REG-DHK', name: 'Dhaka Region' } }, { example: { code: 'DIST-001', name: 'Example Distributor', areaId: '<area-uuid>', contactPerson: 'Rahim Uddin', phone: '01700000000' } }, { example: { code: 'RTL-001', name: 'Example Retailer', territoryId: '<territory-uuid>', phone: '01700000000' } }] } })
  async create(@Param('resource') resource: string, @Body() data: any, @Req() req: any) {
    return {
      success: true,
      statusCode: HttpStatus.OK,
      data: await this.service.create(resource, this.organizationId(req), data, req.user?.userId),
    };
  }

  @Patch(':resource/:id')
  async update(@Param('resource') resource: string, @Param('id') id: string, @Body() data: any, @Req() req: any) {
    return {
      success: true,
      statusCode: HttpStatus.OK,
      data: await this.service.update(resource, id, this.organizationId(req), data, req.user?.userId),
    };
  }
}
