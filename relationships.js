'use strict';

module.exports = {
  personPerson: {
    bffsWith : ':TRUSTS_EXPLICITLY',
    trusts : ':TRUSTS',
    knows : ':KNOWS',
    follows: ':TRUSTS_EXPLICITLY|:TRUSTS',
    hasRelationship: ':TRUSTS_EXPLICITLY|:TRUSTS|:KNOWS'
  },
  personEmail: {
    hasEmail: ':HAS_EMAIL'
  },
  personOpinion : {
    opines: ':OPINES',
    thinks: ':THINKS'
  },
  personLocation :{
    constituentOf: ':CONSTITUENT_OF'
  },
  opinionTopic : {
    addresses: ':ADDRESSES'
  },
  locationRel : {
    country : ':COUNTRY',
    city : ':CITY',
    postalCode : ':POSTAL'
  }
};
