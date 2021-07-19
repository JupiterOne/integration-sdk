# JupiterOne Integration Step Patterns

JupiterOne Integrations built with the Node.js
[integration sdk](https://github.com/JupiterOne/sdk) rely on a dependency graph
to ingest new entities and relationships for synchronization in the JupiterOne
graph. In JupiterOne terminology, we refer to each node in the dependency graph
as a _step_. It's best practice to ensure that each step is responsible for
ingesting a single resource or relationship, as this reduces complexity and
makes testing, troubleshooting, and execution easier to manage. A general
guideline is that each step should be hitting _one_ API endpoint at most.

There are a few standard patterns that emerge when designing steps for a
JupiterOne integration. Here, we assign names to each of these patterns in order
to build a shared, referenceable grammar to use when developing new JupiterOne
integrations.

Let's imagine a JupiterOne integration for a device management tool, "Acme".
This integration ingests the following entities and relationships:

- Entities
  - `acme_account`
  - `acme_user`
  - `acme_group`
  - `acme_device`
  - `acme_device_application`
- Relationships
  - `acme_account_has_user`
  - `acme_account_has_group`
  - `acme_group_has_user`
  - `acme_user_has_device`
  - `acme_device_has_application`

In order to design the optimal mapping of steps to their entities &
relationships, you'll need to read the API specification of the target system.
For the sake of this example, let's assume the API spec is composed of the
following endpoints:

- Endpoints
  - ```
    GET /account
    {
      id: 'account-id',
      ...
    }
    ```
  - ```
    GET /users
    {
      id: 'user-id',
      device: { id: 'device-id' },
      ...
    }
    ```
  - ```
    GET /groups
    {
      id: 'group-id',
      ...
    }
    ```
  - ```
    GET /groups/{groupId}/users
    {
      id: 'user-id',
      ...
    }
    ```
  - ```
    GET /devices
    {
      id: 'device-id',
      ...
    }
    ```
  - ```
    GET /devices/{deviceId}/applications
    {
      id: 'application-id',
      ...
    }
    ```

For this example, based on my API spec, I would ingest these entities and
relationships in the following steps:

- Steps
  - **Fetch Account**
  - **Fetch Users**
  - **Fetch Groups**
  - **Fetch Group to User Relationships**
  - **Fetch Devices**
  - **Build User to Device Relationships**
  - **Fetch Applications for Device**

## "Singleton" step pattern

Typically, target systems will have some type of `Account` entity that should be
pulled in as the integration's root node to the JupiterOne graph. Often, account
properties are fetched at an endpoint such as `/account` or `/organization`.

The **Singleton** step pattern simply fetches data from that `/account` endpoint
and creates the root entity. In addition, the `Account` entity is often used to
build relationships to downstream entities such as `User`s or `Group`s, so we
typically store this `Account` entity in our job state for easy retrieval later.

The archetype for the **Singleton** pattern:

```typescript
const fetchAccountStep: Step = {
  id: 'fetch-account',
  name: 'Fetch Account',
  entities: [{ _type: 'acme_account', ... }],
  relationships: [],
  dependsOn: [],
  executionHandler: (context) => {
    const { jobState, instance } = context;
    const client = new AcmeClient({ config: instance.config });

    const account = await client.getAccount();

    const accountEntity = createAccountEntity(account);
    await jobState.addEntity(accountEntity);
    await jobState.setData(accountEntity, 'ACCOUNT_ENTITY');
  },
}
```

## "Fetch Entities" step pattern

Endpoints that return a list of resources from a path such as `/users`,
`/groups`, or `/devices`, without path parameters, should typically be ingested
using the **Fetch Entities** pattern. Sometimes, but not always, these basic
list resources have an implicit relationship back to the `Account` entity.

The archetype for the **Fetch Entities** pattern:

```typescript
const fetchUsersStep: Step = {
  id: 'fetch-users',
  name: 'Fetch Users',
  entities: [{ _type: 'acme_user', ... }],
  relationships: [{ _type: 'acme_account_has_user', ... }],
  dependsOn: ['fetch-account'],
  executionHandler: (context) => {
    const { jobState, instance } = context;
    const accountEntity = await jobState.getData('ACCOUNT_ENTITY');
    const client = new AcmeClient({ config: instance.config });

    await client.iterateUsers(
      async (user) => {
        const userEntity = createUserEntity(user);
        await jobState.addEntity(userEntity);

        const accountUserRelationship = createDirectRelationship({
          from: accountEntity,
          _class: RelationshipClass.HAS,
          to: userEntity,
        });
        await jobState.addRelationship(accountUserRelationship);
      }
    );
  },
}
```

## "Fetch Relationships" step pattern

Endpoints that list resources using path parameters, such as
`/groups/{groupId}/users`, typically indicate either the **Fetch Relationships**
pattern or the **Fetch Child Entities** pattern, described below. Target
resources (in this case, `acme_user`) otherwise listed from a top-level **list**
endpoint (like `/users`), signal that JupiterOne entities will be created
elsewhere using a **Fetch Entities** pattern and that this endpoint should be
handled with a **Fetch Relationships** pattern.

This type of step ingests no new entities, and instead builds relationships
between existing entities. This pattern uses the `jobState.iterateEntities` and
`jobState.findEntity` methods to reference entities that have already been added
to the job state in previous steps. It's important that both the `fetch-groups`
and `fetch-users` steps complete first, indicated in the step's `dependsOn`
field.

The archetype for the **Fetch Relationships** pattern:

```typescript
const fetchGroupUserRelationships: Step = {
  id: 'fetch-group-to-user-relationships',
  name: 'Fetch Group to User Relationships',
  entities: [],
  relationships: [{ _type: 'acme_group_has_user', ... }],
  dependsOn: ['fetch-groups', 'fetch-users'],
  executionHandler: (context) => {
    const { jobState, instance } = context;
    const client = new AcmeClient({ config: instance.config });

    await jobState.iterateEntities(
      { _type: 'acme_group' },
      async (groupEntity) => {
        // Use `getRawData` to convert `groupEntity` back to the typed interface for AcmeGroup
        const group = await getRawData<AcmeGroup>(groupEntity);

        await client.iterateGroupUsers(
          { groupId: group.id },
          async (user) => {
            // Use `jobState.findEntity` to find the `acme_user` entity by it's `_key`
            const userEntity = await jobState.findEntity(user.id);

            const groupUserRelationship = createDirectRelationship({
              from: groupEntity,
              _class: RelationshipClass.HAS,
              to: userEntity,
            });
            await jobState.addRelationship(groupUserRelationship);
          };
        );
      }
    );
  },
}
```

## "Fetch Child Entities" step pattern

In our example, the `/devices/{deviceId}/applications` endpoint is not
appropriate for the **Fetch Relationships** pattern since we haven't already
ingested applications from a top-level `/applications` endpoint (the API spec
did not define one). In this case, the **Fetch Child Entities** pattern is most
appropriate, and will handle ingestion of both the `acme_device_application`
entities and the `acme_device_has_application` relationships.

The archetype for the **Fetch Child Entities** pattern:

```typescript
const fetchDeviceApplications: Step = {
  id: 'fetch-device-applications',
  name: 'Fetch Device Applications',
  entities: [{ _type: 'acme_device_application', ... }],
  relationships: [{ _type: 'acme_device_has_application', ... }],
  dependsOn: ['fetch-devices'],
  executionHandler: (context) => {
    const { jobState, instance } = context;
    const client = new AcmeClient({ config: instance.config });

    await jobState.iterateEntities(
      { _type: 'acme_device' },
      async (deviceEntity) => {
        const device = await getRawData<AcmeDevice>(deviceEntity);

        await client.iterateDeviceApplications(
          { deviceId: device.id },
          async (application) => {
            const applicationEntity = createApplicationEntity(application);
            await jobState.addEntity(applicationEntity);

            const deviceApplicationRelationship = createDirectRelationship({
              from: deviceEntity,
              _class: RelationshipClass.HAS,
              to: applicationEntity,
            });
            await jobState.addRelationship(deviceApplicationRelationship);
          };
        );
      }
    );
  },
}
```

## "Build Child Relationships" step pattern

Recall from our API spec that there is no endpoint directly linking `acme_user`s
to their `acme_device`. Instead, the API response for the `/users` endpoint
returns the user's device ID.

```
GET /users
{
  id: 'user-id',
  device: { id: 'device-id' },
  ...
}
```

Here, we use the **Build Child Relationships** pattern to build these
relationships once both the `fetch-users` and `fetch-devices` steps have
completed. This pattern is unique in that it is the only pattern which does not
require the `AcmeClient`.

The archetype for the **Build Child Relationships** pattern:

```typescript
const buildUserDeviceRelationships: Step = {
  id: 'build-user-device-relationships',
  name: 'Build User to Device Relationships',
  entities: [],
  relationships: [{ _type: 'acme_user_has_device', ... }],
  dependsOn: ['fetch-users', 'fetch-devices'],
  executionHandler: (context) => {
    const { jobState } = context;

    await jobState.iterateEntities(
      { _type: 'acme_user' },
      async (userEntity) => {
        const user = getRawData<AcmeUser>(userEntity);
        const deviceEntity = await jobState.findEntity(user.device.id);

        const userDeviceRelationship = createDirectRelationship({
          from: userEntity,
          _class: RelationshipClass.HAS,
          to: deviceEntity,
        });
        await jobState.addRelationship(userDeviceRelationship);
      }
    );
  },
}
```

## Conclusion

With JupiterOne, it's easy to ingest data from large, complex target systems
like AWS, GCP, and Azure by leveraging the integration SDK's dependency graph of
small, atomic steps. The five simple patterns described above can handle the
vast majority of new ingestion into the JuptierOne platform. Check out our
open-source ingestion projects at <https://github.com/JupiterOne> for more
ingestion examples.
