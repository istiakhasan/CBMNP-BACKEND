import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { EcommerceService } from './ecommerce.service';
import { ApiHeader, ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';

@ApiTags('E-Commerce & Storefront Studio')
@Controller('v1/ecommerce')
export class EcommerceController {
  constructor(private readonly ecommerceService: EcommerceService) {}

  private organizationId(req: any): string {
    const orgId = req.headers['x-organization-id'];
    if (!orgId || typeof orgId !== 'string') {
      return (req as any).user?.organizationId || 'default-org';
    }
    return orgId;
  }

  // ─── DASHBOARD ─────────────────────────────────────────────────────────────
  @Get('dashboard')
  @ApiOperation({ summary: 'Get e-commerce store dashboard overview' })
  async getDashboard(@Req() req: any) {
    const data = await this.ecommerceService.getDashboardStats(this.organizationId(req));
    return { success: true, statusCode: HttpStatus.OK, data };
  }

  // ─── STORE SETTINGS & CUSTOMIZATION ─────────────────────────────────────────
  @Get('settings')
  @ApiOperation({ summary: 'Get store profile, brand styling, and theme config' })
  async getSettings(@Req() req: any) {
    const data = await this.ecommerceService.getSettings(this.organizationId(req));
    return { success: true, statusCode: HttpStatus.OK, data };
  }

  @Patch('settings')
  @ApiOperation({ summary: 'Update store branding, banner colors, announcement, and payment options' })
  async updateSettings(@Body() body: any, @Req() req: any) {
    const data = await this.ecommerceService.updateSettings(this.organizationId(req), body);
    return { success: true, statusCode: HttpStatus.OK, data };
  }

  // ─── PUBLIC STOREFRONT CONFIG & PRODUCTS (USED BY E-COMMERCE STOREFRONT APP) ───────────
  @Get('storefront/config')
  @ApiOperation({ summary: 'Public endpoint to fetch active theme, hero banners, sections, collections, and policies' })
  async getStorefrontConfig(@Req() req: any) {
    const data = await this.ecommerceService.getStorefrontConfig(this.organizationId(req));
    return { success: true, statusCode: HttpStatus.OK, data };
  }

  @Get('storefront/products')
  @ApiOperation({ summary: 'Public endpoint to fetch products catalog with stock inventory for storefront' })
  async getStorefrontProducts(@Req() req: any) {
    const data = await this.ecommerceService.getStorefrontProducts(this.organizationId(req));
    return { success: true, statusCode: HttpStatus.OK, data };
  }

  @Post('storefront/checkout')
  @ApiOperation({ summary: 'Public checkout endpoint to create new customer order in CBMNP ERP' })
  async createStorefrontOrder(@Body() body: any, @Req() req: any) {
    const data = await this.ecommerceService.createStorefrontOrder(body, this.organizationId(req));
    return { success: true, statusCode: HttpStatus.CREATED, data };
  }

  // ─── COUPON VALIDATION ──────────────────────────────────────────────────────
  @Post('coupons/validate')
  @ApiOperation({ summary: 'Validate discount coupon code for shopping cart' })
  async validateCoupon(@Body() body: { code: string; orderTotal: number }, @Req() req: any) {
    if (!body.code) {
      throw new BadRequestException('Coupon code is required');
    }
    const data = await this.ecommerceService.validateCoupon(
      this.organizationId(req),
      body.code,
      Number(body.orderTotal || 0),
    );
    return { success: true, statusCode: HttpStatus.OK, data };
  }

  // ─── GENERIC RESOURCE CRUD (BANNERS, SECTIONS, COLLECTIONS, COUPONS, SHIPPING, REVIEWS, PAGES) ───
  @Get(':resource')
  @ApiParam({ name: 'resource', enum: ['banners', 'sections', 'collections', 'coupons', 'shipping', 'reviews', 'pages'] })
  async findAll(@Param('resource') resource: string, @Query() query: any, @Req() req: any) {
    const data = await this.ecommerceService.findAll(resource, this.organizationId(req), query);
    return { success: true, statusCode: HttpStatus.OK, data };
  }

  @Get(':resource/:id')
  async findOne(@Param('resource') resource: string, @Param('id') id: string, @Req() req: any) {
    const data = await this.ecommerceService.findOne(resource, id, this.organizationId(req));
    return { success: true, statusCode: HttpStatus.OK, data };
  }

  @Post(':resource')
  async create(@Param('resource') resource: string, @Body() body: any, @Req() req: any) {
    const data = await this.ecommerceService.create(resource, this.organizationId(req), body);
    return { success: true, statusCode: HttpStatus.CREATED, data };
  }

  @Patch(':resource/:id')
  async update(@Param('resource') resource: string, @Param('id') id: string, @Body() body: any, @Req() req: any) {
    const data = await this.ecommerceService.update(resource, id, this.organizationId(req), body);
    return { success: true, statusCode: HttpStatus.OK, data };
  }

  @Delete(':resource/:id')
  async remove(@Param('resource') resource: string, @Param('id') id: string, @Req() req: any) {
    const data = await this.ecommerceService.remove(resource, id, this.organizationId(req));
    return { success: true, statusCode: HttpStatus.OK, data };
  }
}
