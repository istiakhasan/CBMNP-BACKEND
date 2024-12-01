import { InjectRepository } from '@nestjs/typeorm';
import { Like, Repository } from 'typeorm';
import { HttpStatus, Injectable } from '@nestjs/common'
import { Customers } from './entities/customers.entity';
import { plainToInstance } from 'class-transformer';
import { ApiError } from 'src/middleware/ApiError';


@Injectable()
export class CustomerService {
  constructor(
    @InjectRepository(Customers)
    private readonly customerRepository: Repository<Customers>,
  ) {}

  async createCustomer(data: Customers) {

      // Check if a customer with the same phone number already exists
      const existingCustomer = await this.customerRepository.findOne({
        where: { customerPhoneNumber: data.customerPhoneNumber },
      });
  
      if (existingCustomer) {
        throw new ApiError(400,"Number already exist ")
      }
    //    find last document 
    const lastCustomer = await this.customerRepository
      .createQueryBuilder('customer')
      .orderBy('customer.created_at', 'DESC') 
      .getOne();
      const lastCustomerId=lastCustomer?.customer_Id?.substring(2)
       const currentId =lastCustomerId || (0).toString().padStart(9, '0'); //000000
       let incrementedId = (parseInt(currentId) + 1).toString().padStart(9, '0');
       if(data?.customerType==="NON_PROBASHI"){
           incrementedId = `B-${incrementedId}`;
       }
       if(data?.customerType==="PROBASHI"){
           incrementedId = `P-${incrementedId}`;
       }

       const result=await this.customerRepository.save({...data,customer_Id:incrementedId})

    return result
  }
 



//   get all customers

async getAllCustomers(options, filterOptions) {
    const page = Number(options.page || 1);
    const limit = Number(options.limit || 10);
    const skip = (page - 1) * limit;
    const sortBy = options.sortBy || 'created_at';
    const sortOrder = (options.sortOrder || 'DESC').toUpperCase();

    const queryBuilder = this.customerRepository.createQueryBuilder('customers')
        .leftJoinAndSelect('customers.orders', 'orders')
        .take(limit)
        .skip(skip)
        .orderBy(`customers.${sortBy}`, sortOrder);

    // Search
    if (filterOptions?.searchTerm) {
        const searchTerm = `%${filterOptions.searchTerm}%`;
        queryBuilder.andWhere(
            '(customers.customerName LIKE :searchTerm OR customers.customer_Id LIKE :searchTerm OR customers.customerPhoneNumber LIKE :searchTerm)',
            { searchTerm }
        );
    }

    // Filter by customerType
    if (filterOptions?.filterByCustomerType) {
        queryBuilder.andWhere('customers.customerType = :customerType', {
            customerType: filterOptions.filterByCustomerType,
        });
    }

    // Execute query
    const [data, total] = await queryBuilder.getManyAndCount();

    const modifyData = plainToInstance(Customers, data);

    return {
        data: modifyData,
        total,
        page,
        limit,
    };
}

}
