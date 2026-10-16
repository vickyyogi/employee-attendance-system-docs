class CompanyMembershipModel {
  final String id;
  final String companyId;
  final String companyName;
  final String companySlug;
  final String role;
  final String status;

  const CompanyMembershipModel({
    required this.id,
    required this.companyId,
    required this.companyName,
    required this.companySlug,
    required this.role,
    required this.status,
  });

  factory CompanyMembershipModel.fromJson(Map<String, dynamic> json) {
    return CompanyMembershipModel(
      id: json['id'] as String,
      companyId: json['companyId'] as String,
      companyName: json['companyName'] as String,
      companySlug: json['companySlug'] as String,
      role: json['role'] as String,
      status: json['status'] as String? ?? 'ACTIVE',
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'companyId': companyId,
        'companyName': companyName,
        'companySlug': companySlug,
        'role': role,
        'status': status,
      };
}

class ActiveCompanyModel {
  final String id;
  final String name;
  final String slug;
  final String role;
  final List<String> permissions;
  final String? timezone;

  const ActiveCompanyModel({
    required this.id,
    required this.name,
    required this.slug,
    required this.role,
    required this.permissions,
    this.timezone,
  });

  factory ActiveCompanyModel.fromJson(Map<String, dynamic> json) {
    return ActiveCompanyModel(
      id: json['id'] as String,
      name: json['name'] as String,
      slug: json['slug'] as String,
      role: json['role'] as String? ?? 'EMPLOYEE',
      permissions: (json['permissions'] as List<dynamic>?)
              ?.map((e) => e.toString())
              .toList() ??
          [],
      timezone: json['timezone'] as String? ?? 'Asia/Jakarta',
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'name': name,
        'slug': slug,
        'role': role,
        'permissions': permissions,
        'timezone': timezone,
      };
}
