package ch.guessthat;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

import java.io.IOException;

import static ch.guessthat.util.ConfigLoader.loadConfig;

@SpringBootApplication
public class GuessThatApplication {

	public static void main(String[] args) {
		SpringApplication.run(GuessThatApplication.class, args);
	}
}
