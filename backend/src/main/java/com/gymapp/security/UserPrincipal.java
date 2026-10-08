package com.gymapp.security;

import com.gymapp.module.auth.entity.User;
import lombok.Getter;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

import java.util.Collection;
import java.util.List;

/**
 * Spring Security principal backed by the {@link User} entity.
 * Used by {@link CustomUserDetailsService} and during password authentication.
 */
@Getter
public class UserPrincipal implements UserDetails {

    private final String userId;
    private final String gymId;
    private final String phone;
    private final String password;     // hashed
    private final String role;
    private final boolean active;
    private final Collection<? extends GrantedAuthority> authorities;

    public UserPrincipal(User user) {
        this.userId      = user.getId();
        this.gymId       = user.getGymId();
        this.phone       = user.getPhone();
        this.password    = user.getPasswordHash();
        this.role        = user.getRole();
        this.active      = user.isActive();
        this.authorities = List.of(new SimpleGrantedAuthority("ROLE_" + user.getRole()));
    }

    @Override public String getUsername()               { return phone; }
    @Override public boolean isAccountNonExpired()      { return true; }
    @Override public boolean isAccountNonLocked()       { return true; }
    @Override public boolean isCredentialsNonExpired()  { return true; }
    @Override public boolean isEnabled()                { return active; }
}
