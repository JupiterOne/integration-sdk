# Integration with JupiterOne

## Setup

In this section, please provide details about how to set up the integration with
JupiterOne. This may require provisioning some resources on the provider's side
(perhaps a role, app, or api key) and passing information over to JupiterOne.

## Data Model

Provide an overview here of the resources collected from the integration. Please
provide a mapping of how the resources collected map to the JupiterOne Data
Model. The tables below were taken from the Azure integration to provide an
example of how to display that information.

When you start developing an integration, please clear out the tables below. As
you add support for new entities and relationships, please update the tables and
document the addition in the [CHANGELOG.md](../CHANGELOG.md) file at the root of
the project.

### Entities

Provide a table that maps concepts from the provider to the `_type` and `_class`
generated.

| Resources         | \_type of the Entity          | \_class of the Entity           |
| ----------------- | ----------------------------- | ------------------------------- |
| Compute           | `azure_vm`                    | `Host`                          |
|                   | `azure_image`                 | `Image`                         |
|                   | `azure_managed_disk`          | `DataStore`, `Disk`             |
| Load Balancer     | `azure_lb`                    | `Gateway`                       |
| Virtual Network   | `azure_vnet`                  | `Network`                       |
| Subnet            | `azure_subnet`                | `Network`                       |
| Security Group    | `azure_security_group`        | `Firewall`                      |
| Network Interface | `azure_nic`                   | `NetworkInterface`              |
| Public IP Address | `azure_public_ip`             | `IpAddress`                     |
| Blob (Storage)    | `azure_storage_container`     | `DataStore`                     |
| Databases         | `azure_mariadb_database`      | `Database`, `DataStore`         |
|                   | `azure_mariadb_server`        | `Database`, `DataStore`, `Host` |
|                   | `azure_mysql_database`        | `Database`, `DataStore`         |
|                   | `azure_mysql_server`          | `Database`, `DataStore`, `Host` |
|                   | `azure_postgresql_database`   | `Database`, `DataStore`         |
|                   | `azure_postgresql_server`     | `Database`, `DataStore`, `Host` |
|                   | `azure_sql_database`          | `Database`, `DataStore`         |
|                   | `azure_sql_server`            | `Database`, `DataStore`, `Host` |
| Cosmos DB         | `azure_cosmosdb_account`      | `Account`                       |
|                   | `azure_cosmosdb_sql_database` | `Database`, `DataStore`         |

### Relationships

The following relationships are created/mapped:

| From                         | Edge         | To                            |
| ---------------------------- | ------------ | ----------------------------- |
| `azure_account`              | **HAS**      | `azure_user`                  |
| `azure_account`              | **HAS**      | `azure_user_group`            |
| `azure_account`              | **HAS**      | `azure_storage_blob_service`  |
| `azure_user_group`           | **HAS**      | `azure_user`                  |
| `azure_user_group`           | **HAS**      | `azure_user_group`            |
| `azure_user_group`           | **HAS**      | `azure_group_member`          |
| `azure_vnet`                 | **CONTAINS** | `azure_subnet`                |
| `azure_subnet`               | **HAS**      | `azure_vm`                    |
| `azure_security_group`       | **PROTECTS** | `azure_subnet`                |
| `azure_security_group`       | **PROTECTS** | `azure_nic`                   |
| `azure_vm`                   | **USES**     | `azure_nic`                   |
| `azure_vm`                   | **USES**     | `azure_managed_disk`          |
| `azure_vm`                   | **USES**     | `azure_public_ip`             |
| `azure_lb`                   | **CONNECTS** | `azure_nic`                   |
| `azure_storage_blob_service` | **HAS**      | `azure_storage_container`     |
| `azure_mariadb_server`       | **HAS**      | `azure_mariadb_database`      |
| `azure_mysql_server`         | **HAS**      | `azure_mysql_database`        |
| `azure_postgresql_server`    | **HAS**      | `azure_postgresql_database`   |
| `azure_sql_server`           | **HAS**      | `azure_sql_database`          |
| `azure_cosmosdb_account`     | **HAS**      | `azure_cosmosdb_sql_database` |
